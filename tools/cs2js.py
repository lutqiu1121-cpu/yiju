#!/usr/bin/env python3
"""server/Rules/*.cs → client/rules-port/all-rules.js

定向转译：只针对本项目规则代码的受限 C# 子集。
- 块级：属性 getter → JS getter；删除由 base.js / cs-runtime.js 手写的类。
- 行级：去类型化 + C# API 映射（方法名尽量保留，由运行时垫片吸收语义差异）。
- 双引号字符串与 // 注释先屏蔽，避免被去类型正则误伤。

产物必须同时通过：
  node --check
  node tools/rules-vector.test.mjs
  node tools/rules-all.test.mjs
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'server' / 'Rules'
OUT = ROOT / 'client' / 'rules-port' / 'all-rules.js'

FILES = [
    'IGameRule.cs', 'BoardGames.cs', 'PieceGames.cs', 'CardGames.cs',
    'TableExtras.cs', 'PartyGames.cs', 'ExtraGames.cs',
    'OrigSeven.cs', 'YiJuan.cs', 'OriginalGame.cs',
]

# 这些类由 base.js / cs-runtime.js 手写提供，不转译
SKIP_CLASSES = {
    'IGameRule', 'GameState', 'MoveResult', 'RuleBase', 'Diff',
    'Cfg', 'RuleRegistry', 'ScriptGateway', 'Fractions', 'Frac', 'Parser',
}

MOD = r'(?:public|private|protected|internal|static|override|virtual|abstract|sealed|readonly|const|extern|new|partial)'


def find_close(s, open_at):
    depth = 0
    for j in range(open_at, len(s)):
        if s[j] == '{': depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0: return j
    return len(s) - 1


def strip_wrappers(src):
    src = re.sub(r'^\s*using\s+.*?;\s*$', '', src, flags=re.M)
    m = re.search(r'^\s*namespace\s+Qipai\s*\r?\n\s*\{\s*\r?\n', src, flags=re.M)
    if m:
        src = src[m.end():]
    src = re.sub(r'^\s*\[[^\]]+\]\s*$', '', src, flags=re.M)
    src = src.rstrip()
    if src.endswith('}'): src = src[:-1]   # namespace 闭合
    return src


def remove_class(src, name):
    """按类名删除整个 class/struct 块（含嵌套），从后往前删多个。"""
    while True:
        m = re.search(r'\b(?:class|struct|interface)\s+' + re.escape(name) + r'\b[^\{]*\{', src)
        if not m: return src
        open_at = src.index('{', m.start())
        end = find_close(src, open_at)
        line_start = src.rfind('\n', 0, m.start()) + 1
        src = src[:line_start] + src[end + 1:]


def convert_list_ctors(src):
    """new List<T>(ARG) → (ARG).slice()，括号平衡匹配，避免 ARG 内含括号被截断。"""
    pat = re.compile(r'new\s+List<[^>]+>\s*\(')
    guard = 0
    while guard < 5000:
        m = pat.search(src)
        if not m: break
        guard += 1
        o = m.end() - 1
        depth = 0; j = o
        while j < len(src):
            if src[j] == '(': depth += 1
            elif src[j] == ')':
                depth -= 1
                if depth == 0: break
            j += 1
        inner = src[o + 1:j].strip()
        repl = '[]' if not inner else '(' + inner + ').slice()'
        src = src[:m.start()] + repl + src[j + 1:]
    return src


def convert_array_inits(src):
    """new int[]{...} / new int[][]{...} → JS 数组字面量（先内后外）。"""
    for _ in range(4):
        src = re.sub(r'new\s*\[\s*\]\s*\{([^{}]*)\}', r'[\1]', src)
        src = re.sub(r'new\s+\w+\s*\[\s*\]\s*\{([^{}]*)\}', r'[\1]', src)
        src = re.sub(r'new\s+\w+\s*\[\s*\]\s*\[\s*\]\s*\{([^{}]*)\}', r'[\1]', src)
        src = re.sub(r'new\s+List<[^>]+>\s*\{([^{}]*)\}', r'[\1]', src)
        src = re.sub(r'new\s+List<[^>]+>\s*\[\s*([^\]]+)\s*\]', r'CS.newList(\1)', src)
    return src


def convert_dict_inits(src):
    """new Dictionary<K,V> { {'a',1}, ... } → { 'a':1, ... }"""
    pat = re.compile(r'new\s+Dictionary<[^>]+>\s*\{')
    for _ in range(20):
        m = pat.search(src)
        if not m: break
        open_at = m.end() - 1
        end = find_close(src, open_at)
        inner = src[open_at + 1:end]
        inner = re.sub(r'\{\s*([^{}]*?),\s*([^{}]*?)\s*\}', r'\1:\2', inner)
        src = src[:m.start()] + '{' + inner + '}' + src[end + 1:]
    return src


def convert_brace_arrays(src):
    """C# 隐式数组初始化 `= { ... };` → `= [ ... ];`（含跨行）。
    内容含冒号的视为字典/对象初始化器，跳过。"""
    for m in reversed(list(re.finditer(r'=\s*\{', src))):
        open_at = m.end() - 1
        end = find_close(src, open_at)
        inner = src[open_at + 1:end]
        if ':' in inner: continue
        src = src[:open_at] + '[' + inner + ']' + src[end + 1:]
    return src


def convert_getters(src):
    """把 `TYPE NAME { get { BODY } }` 整体换成 `get NAME() { BODY }`（含单行）。"""
    pat = re.compile(r'\b(\w+)\s*\{\s*get\s*\{')
    spans = []
    for m in pat.finditer(src):
        prop_open = m.start() + m.group(0).index('{')
        get_open = m.end() - 1
        get_close = find_close(src, get_open)
        prop_close = find_close(src, prop_open)
        if get_close < 0 or prop_close < get_close: continue
        line_start = src.rfind('\n', 0, m.start()) + 1
        indent = re.match(r'[ \t]*', src[line_start:m.start()]).group(0)
        body = src[get_open + 1:get_close]
        repl = f'{indent}get {m.group(1)}() {{{body}}}'
        spans.append((line_start, prop_close + 1, repl))
    for a, b, repl in reversed(spans):
        src = src[:a] + repl + src[b:]
    return src


def split_top(s, sep=','):
    out, depth, cur = [], 0, ''
    for c in s:
        if c in '<([{': depth += 1
        elif c in '>)]}': depth -= 1
        if c == sep and depth == 0:
            out.append(cur); cur = ''
        else: cur += c
    out.append(cur)
    return out


def strip_params(p):
    p = (p or '').strip()
    if not p: return ''
    out = []
    for part in split_top(p):
        part = part.strip()
        if not part: continue
        if part.startswith('params '):
            part = part[7:].strip()
            m = re.match(r'^(.*)\s+([A-Za-z_]\w*)(\s*=.*)?$', part)
            out.append('...' + (m.group(2) if m else part))
            continue
        part = re.sub(r'^(?:ref|out|in)\s+', '', part)
        m = re.match(r'^(.*)\s+([A-Za-z_]\w*)(\s*=.*)?$', part)
        out.append((m.group(2) + (m.group(3) or '')) if m else part)
    return ', '.join(out)


MODS_PREFIX = re.compile(
    r'^(\s*)((?:' + MOD + r'\s+)+)([\w<>\[\],\s]+?)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(\{?)(.*)$')
CTOR_PREFIX = re.compile(
    r'^(\s*)((?:public|private|internal|protected)\s+)([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(\{?)(.*)$')
FIELD_LINE = re.compile(
    r'^(\s*)((?:' + MOD + r'\s+)+)([\w<>\[\],\s]+?)\s+([A-Za-z_]\w*)\s*(=\s*.*?)?(;?)\s*$')
LOCAL_TYPE = re.compile(
    r'(?<![\w"\'.])\b(?:'
    r'int|long|string|bool|double|object|var|char|byte|float|decimal|'
    r'GameState|MoveResult|IGameRule|Frac|Fractions\.Frac|Fractions\.Parser|'
    r'System\.Text\.StringBuilder|StringBuilder|'
    r'(?:string|int|bool|object|double|long|char)\[\]\[\]|(?:string|int|bool|object|double|long|char)\[\]|'
    r'List<.+?>>|List<string>\[\]|List<[^>]*>|Dictionary<[^>]*>|'
    r'HashSet<[^>]*>|Stack<[^>]*>|Queue<[^>]*>|'
    r'Func<[^>]*>|Action<[^>]*>|IEnumerable<[^>]*>|'
    r'(?:string|int|bool|object|double|long|char)\[\]|int\[\]|string\[\]'
    r')\s+(?=[A-Za-z_])')


def mask(line):
    """屏蔽双引号字符串，返回 (masked, restore_map)。"""
    saved = []
    def put(m):
        saved.append(m.group(0))
        return '\x01%d\x01' % (len(saved) - 1)
    masked = re.sub(r'"(?:[^"\\]|\\.)*"', put, line)
    return masked, saved


def unmask(line, saved):
    for i, s in enumerate(saved):
        line = line.replace('\x01%d\x01' % i, s)
    return line


def fix_trygetvalue(line):
    """obj.TryGetValue(KEY, out v) → CS.tg(obj, KEY, _v => v = _v).ok
    括号平衡匹配，支持 KEY 为函数调用（含逗号）的情形。"""
    guard = 0
    while guard < 200:
        guard += 1
        m = re.search(r'([\w\.\[\]"]+)\.TryGetValue\(', line)
        if not m: break
        obj = m.group(1)
        o = m.end() - 1
        depth = 0; j = o
        while j < len(line):
            if line[j] == '(': depth += 1
            elif line[j] == ')':
                depth -= 1
                if depth == 0: break
            j += 1
        if j >= len(line): break
        inner = line[o + 1:j]
        parts = split_top(inner)
        vm = re.match(r'\s*out\s+(\w+)\s*$', parts[-1]) if len(parts) >= 2 else None
        if not vm: break
        key = ','.join(parts[:-1]).strip()
        repl = 'CS.tg(%s, %s, _v => %s = _v).ok' % (obj, key, vm.group(1))
        line = line[:m.start()] + repl + line[j + 1:]
    return line


def expr(line):
    """C# API → JS / 垫片。字符串已屏蔽。"""
    # 强转优先删除：否则 new List<T>((string[])x) 会被括号截断
    line = re.sub(r'\(\s*(?:bool|int|string|object|char)\[\]\s*\)\s*', '', line)
    line = re.sub(r'\(\s*(?:int|long|double|char|bool|string)\s*\)\s*(?=[A-Za-z_(])', '', line)
    # 数组创建
    line = re.sub(r'new\s+(?:string|int|bool|object|double|long)\s*\[\s*([^\]]+)\s*\]',
                  lambda m: 'CS.newArr(%s, %s)' % (
                      m.group(1), {'string': '""', 'int': '0', 'bool': 'false',
                                   'double': '0', 'long': '0', 'object': 'null'}[
                          re.search(r'new\s+(\w+)', m.group(0)).group(1)]), line)
    line = re.sub(r'new\s+List<[^>]+>\s*\(\s*\)', '[]', line)
    line = re.sub(r'new\s+Dictionary<[^>]+>\s*\(\s*\)', '{}', line)
    line = re.sub(r'new\s+Dictionary<[^>]+>\s*\(([^)]+)\)', r'Object.assign({}, \1)', line)
    line = re.sub(r'new\s+HashSet<[^>]+>\s*\(\s*\)', 'new CS.Set()', line)
    line = re.sub(r'new\s+Stack<[^>]+>\s*\(\s*\)', 'new CS.Stack()', line)
    line = re.sub(r'new\s+Queue<[^>]+>\s*\(\s*\)', 'new CS.Queue()', line)
    line = re.sub(r'new\s+(?:System\.Text\.)?StringBuilder\s*\(\s*\)', 'new CS.SB()', line)
    line = re.sub(r'new\s+string\s*\(\s*([^)]+)\s*\)', r'\1.join("")', line)
    line = re.sub(r'new\s+(\w+)\s*\{\s*([^{}]*?)\s*\}',
                  lambda m: 'Object.assign(new %s(), {%s})' % (m.group(1), m.group(2)), line)
    # as / is / 强转
    line = re.sub(r'\s+as\s+(?:string\[\]|int\[\]|bool\[\]|object\[\]|string|int|bool|object|'
                  r'Dictionary<[^>]+>|List<[^>]+>|Func<[^>]+>|Action<[^>]+>)', '', line)
    line = re.sub(r'\b([A-Za-z_]\w*)\s+is\s+(?:string\[\]|int\[\]|bool\[\]|object\[\])',
                  r'CS.isArr(\1)', line)
    line = re.sub(r'\b([A-Za-z_]\w*)\s+is\s+Dictionary<[^>]+>', r'CS.isObj(\1)', line)
    line = re.sub(r'\b([A-Za-z_]\w*)\s+is\s+(?:string|bool|int)\b', r'CS.isType(\1)', line)
    line = re.sub(r'\(\s*(?:bool|int|string|object|char)\[\]\s*\)\s*', '', line)
    line = re.sub(r'\(\s*(?:int|long|double|char|bool|string)\s*\)\s*(?=[A-Za-z_(])', '', line)
    line = re.sub(r'\(\s*Array\s*\)', '', line)
    line = re.sub(r'\((?:bool|int|string|object)\[\]\)', '', line)
    # out / TryGetValue / TryParse
    line = re.sub(r'(\w+)\.Parse\(out\s+(\w+)\s*,\s*([^)]+)\)',
                  r'CS.pp(\1, \3, _v => \2 = _v)', line)
    line = fix_trygetvalue(line)
    line = re.sub(r'\bint\.TryParse\(([^,]+),\s*out\s+(\w+)\)',
                  r'CS.tp(\1, _v => \2 = _v)', line)
    line = re.sub(r'\bdouble\.TryParse\(([^,]+),\s*out\s+(\w+)\)',
                  r'CS.tp(\1, _v => \2 = _v)', line)
    line = re.sub(r'\bout\s+\w+', 'undefined', line)
    line = re.sub(r'\bref\s+', '', line)
    # Convert / string / Math / Array
    line = re.sub(r'\b(?:int|long|double|float|decimal)\.Parse\s*\(', 'CS.int(', line)
    line = re.sub(r'\bConvert\.ToString\s*\(', 'CS.str(', line)
    line = re.sub(r'\bConvert\.ToInt32\s*\(', 'CS.int(', line)
    line = re.sub(r'\bConvert\.ToInt64\s*\(', 'CS.int(', line)
    line = re.sub(r'\bConvert\.ToDouble\s*\(', 'CS.num(', line)
    line = re.sub(r'\bConvert\.ToBoolean\s*\(', 'CS.bool(', line)
    line = re.sub(r'\bstring\.IsNullOrEmpty\s*\(', 'CS.empty(', line)
    line = re.sub(r'\bstring\.IsNullOrWhiteSpace\s*\(', 'CS.empty(', line)
    line = re.sub(r'\bstring\.Join\s*\(', 'CS.join(', line)
    line = re.sub(r'\bstring\.Format\s*\(', 'CS.format(', line)
    line = re.sub(r'\bstring\.Concat\s*\(', 'CS.join("", ', line)
    line = re.sub(r'\bEnumerable\.Range\s*\(', 'CS.range(', line)
    line = re.sub(r'\bEnumerable\.Repeat\s*\(', 'CS.repeat(', line)
    line = re.sub(r'\bArray\.IndexOf\s*\(', 'CS.indexOf(', line)
    line = re.sub(r'\bArray\.Sort\s*\(', 'CS.sort(', line)
    line = re.sub(r'\bArray\.Copy\s*\(', 'CS.copy(', line)
    line = re.sub(r'\bArray\.Reverse\s*\(', 'CS.sortRev(', line)
    line = re.sub(r'\bArray\.Clear\s*\(', 'CS.clear(', line)
    line = re.sub(r'\bMath\.(Floor|Ceiling|Abs|Min|Max|Sqrt|Round|Pow|Sign|Truncate|Log|Exp)\s*\(',
                  lambda m: 'Math.' + {'Floor':'floor','Ceiling':'ceil','Abs':'abs','Min':'min',
                                       'Max':'max','Sqrt':'sqrt','Round':'round','Pow':'pow',
                                       'Sign':'sign','Truncate':'trunc','Log':'log','Exp':'exp'}[m.group(1)] + '(', line)
    line = re.sub(r'\(\s*CultureInfo\.InvariantCulture\s*\)', '()', line)
    line = re.sub(r'\(\s*System\.Globalization\.CultureInfo\.InvariantCulture\s*\)', '()', line)
    line = re.sub(r',\s*CultureInfo\.InvariantCulture\s*\)', ')', line)
    line = re.sub(r',\s*System\.Globalization\.CultureInfo\.InvariantCulture\s*\)', ')', line)
    line = re.sub(r'(\w+)\.ToString\s*\(\s*"[^"]*"\s*,\s*[^)]+\)', r'CS.fmt(\1)', line)
    line = re.sub(r'(\w+)\.ToString\s*\(\s*"[^"]*"\s*\)', r'CS.fmt(\1)', line)
    line = re.sub(r'\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\.ToString\s*\(\s*\)', r'CS.str(\1)', line)
    line = re.sub(r'=\s*\{\s*([^{}]*?)\s*\}\s*;', r'= [\1];', line)
    line = re.sub(r'\bchar\.IsDigit\b', 'CS.isDigit', line)
    line = re.sub(r'\bchar\.IsWhiteSpace\b', 'CS.isWhite', line)
    line = re.sub(r'\(\s*char\s*\)', 'CS.chr(', line)
    line = re.sub(r'\b(\w+)\.CompareTo\(([^()]*)\)', r'CS.cmp(\1, \2)', line)
    line = re.sub(r'\b(\w+)\.Substring\(', r'CS.substr(\1, ', line)
    line = re.sub(r'\.ToLowerInvariant\s*\(\s*\)', '.toLowerCase()', line)
    line = re.sub(r'\.ToUpperInvariant\s*\(\s*\)', '.toUpperCase()', line)
    line = re.sub(r'\.ToCharArray\s*\(\s*\)', '.ToCharArray()', line)
    line = re.sub(r'\bFractions\.Parser\b', 'CS.FracParser', line)
    line = re.sub(r'\bFractions\.Frac\b', 'CS.Frac', line)
    line = re.sub(r'\bScriptGateway\.', 'CS.ScriptGateway.', line)
    # 属性名
    line = re.sub(r'\.Length\b', '.length', line)
    line = re.sub(r'\.Count\b(?!\s*\()', '.length', line)
    line = re.sub(r'\bbase\.Info\(', 'this.InfoBase(', line)
    line = re.sub(r'\bbase\.([A-Za-z_]\w*)\(', r'super.\1(', line)
    # foreach / catch / delegate / lambda
    line = re.sub(r'\bforeach\s*\(\s*KeyValuePair<[^>]+>\s+(\w+)\s+in\s+([^)]+)\)',
                  r'for (let \1 of CS.entries(\2))', line)
    line = re.sub(r'\bforeach\s*\(\s*(?:var|int|string|bool|object|double|char)\s+(\w+)\s+in\s+([^)]+)\)',
                  r'for (let \1 of \2)', line)
    line = re.sub(r'\bforeach\s*\(\s*let\s+(\w+)\s+in\s+([^)]+)\)', r'for (let \1 of \2)', line)
    line = re.sub(r'\.Trim\s*\(\s*\)', '.trim()', line)
    line = re.sub(r'\bcatch\s*\(\s*Exception\s+(\w+)\s*\)', r'catch (\1)', line)
    line = re.sub(r'\bcatch\s*\(\s*Exception\s*\)', 'catch (e)', line)
    line = re.sub(r'\bthrow\s+new\s+\w+Exception\s*\(', 'throw new Error(', line)
    line = re.sub(r'\bdelegate\s*\(([^)]*)\)\s*(\{?)',
                  lambda m: '(%s) =>%s' % (strip_params(m.group(1)), ' {' if m.group(2) else ''), line)
    line = re.sub(r'\bdelegate\s*\{', '() => {', line)
    line = re.sub(r'\byield\s+return\b', 'yield', line)
    line = re.sub(r'\bnew\s+\w+Exception\s*\(([^)]*)\)', r'new Error(\1)', line)
    # 数字类型后缀（long/float/double/decimal）
    line = re.sub(r'\b(0[xX][0-9A-Fa-f]+)[lLuU]+\b', r'\1', line)
    line = re.sub(r'\b(\d+\.\d+)[fFdDlLmM]\b', r'\1', line)
    line = re.sub(r'\b(\d+)[lLfFdDmM]\b', r'\1', line)
    # 空合并
    line = line.replace(' ?? ', ' || ')
    line = re.sub(r'\?\.\s*', '.', line)
    return line


def translate_line(line):
    raw = line
    if not line.strip(): return ''
    s = line.strip()
    if s.startswith('//') or s.startswith('/*') or s.startswith('*'):
        return line
    indent = re.match(r'[ \t]*', line).group(0)
    line, saved = mask(line)

    # 类头
    m = re.match(r'^(\s*)((?:' + MOD + r'\s+)*)(class|struct|interface)\s+([A-Za-z_]\w*)\s*(?::\s*([A-Za-z_]\w*))?\s*(\{?)\s*$', line)
    if m:
        base = m.group(5)
        tail = ' extends %s' % base if base and base != 'IGameRule' else ''
        line = '%sclass %s%s' % (m.group(1), m.group(4), tail) + (' {' if m.group(6) else '')
        return unmask(line, saved)

    # getter（若块级处理有遗漏）
    m = re.match(r'^(\s*)((?:' + MOD + r'\s+)+)[\w<>\[\],\s]+?\s+([A-Za-z_]\w*)\s*\{\s*get\s*\{\s*(.*?)\s*\}\s*\}\s*$', line)
    if m:
        line = '%sget %s() { %s }' % (m.group(1), m.group(3), m.group(4))
        return unmask(line, saved)

    # 构造函数（保留同行 body）
    m = CTOR_PREFIX.match(line)
    if m and m.group(3) not in ('if', 'for', 'while', 'switch', 'catch'):
        line = '%sconstructor(%s)' % (m.group(1), strip_params(m.group(4))) + (' {' if m.group(5) else '') + m.group(6)
        return unmask(expr(LOCAL_TYPE.sub('let ', line)), saved)

    # 方法签名（含单行方法体）
    m = MODS_PREFIX.match(line)
    if m and m.group(4) not in ('if', 'for', 'while', 'switch', 'catch', 'return'):
        gen = '*' if ('yield ' in line or 'IEnumerable' in m.group(3)) else ''
        static = 'static ' if re.search(r'\bstatic\b', m.group(2)) else ''
        line = '%s%s%s%s(%s)' % (m.group(1), static, gen, m.group(4),
                                 strip_params(m.group(5))) + (' {' if m.group(6) else '') + m.group(7)
        return unmask(expr(LOCAL_TYPE.sub('let ', line)), saved)

    # 字段声明（类成员，必须有访问修饰符）
    m = FIELD_LINE.match(line)
    if m and not re.search(r'\breturn\b|\bif\b|\bfor\b|\bwhile\b', line) and m.group(4) not in ('if', 'for', 'while'):
        static = 'static ' if re.search(r'\b(static|const)\b', m.group(2)) else ''
        val = m.group(5) or ''
        line = '%s%s%s %s' % (m.group(1), static, m.group(4), val) + (';' if m.group(6) else '')
        return unmask(expr(line), saved)

    # 局部变量声明
    line = LOCAL_TYPE.sub('let ', line)
    line = expr(line)
    return unmask(line, saved)


BASE_METHODS = {
    'Id','Renderer','MinSeats','MaxSeats','Variants','Build','Legal','Act','Info','View',
    'O','OL','OB','OS','Opt','OptB','OptI','OptL','OptS','IntV','StrV','BoolV',
    'New','NextRng','Shuffle','Say','MarkFeat','Finish','FinishTeam','Next',
    'Cell','At','X','Y','Inside','CountLine','Line','BelongsTo','SideOf','SideChar',
    'Mine','Put','SetGrid','ParsePair','ParseList','HandSizes','InfoBase','BotThink','BotPick',
    'BotScore','BotLine','GodPick','Score','Clone','Tick'
}


KEYWORDS = {
    'if','for','while','switch','catch','return','new','typeof','function','class',
    'else','do','try','throw','yield','await','of','in','let','const','var','delete',
    'void','instanceof','with','super','this','get','set','static','case','default',
    'break','continue','async','constructor','Array','Object','String','Number',
    'Math','JSON','parseInt','parseFloat','isNaN','Set','Map','Boolean','Error'
}


def collect_methods(js):
    names = set(BASE_METHODS) - KEYWORDS
    for m in re.finditer(r'(?m)^\s*(?:static\s+)?\*?([A-Za-z_]\w*)\s*\([^)]*\)\s*\{', js):
        if m.group(1) not in KEYWORDS: names.add(m.group(1))
    return names


def bind_calls(seg, names):
    for n in sorted(names, key=len, reverse=True):
        seg = re.sub(r'(?<![\w.])(?<!get )(?<!set )' + re.escape(n) + r'\s*\(',
                     'this.' + n + '(', seg)
    return seg


def bind_this_methods(js):
    """C# 同类方法裸调用 → this.NAME(；跳过方法声明部分。"""
    names = collect_methods(js)
    out = []
    for line in js.split('\n'):
        # 只有「方法/构造声明行」保护签名；以 ; 结尾的调用行整行绑定
        m = re.match(r'^(\s*)(?:(?:static|get|set)\s+)?\*?([A-Za-z_]\w*)\s*\([^)]*\)\s*\{?(.*)$', line)
        if (m and (m.group(2) in names or m.group(2) == 'constructor')
                and not line.rstrip().endswith(';')):
            cut = m.start(3)
            out.append(line[:cut] + bind_calls(line[cut:], names))
        else:
            out.append(bind_calls(line, names))
    return '\n'.join(out)


def bind_fields(js):
    """C# 字段裸引用 → this.F / ClassName.F；保护声明行与方法参数。"""
    heads = list(re.finditer(r'(?m)^\s*class\s+(\w+)', js))
    spans = []
    for i, m in enumerate(heads):
        s = m.start()
        e = heads[i + 1].start() if i + 1 < len(heads) else len(js)
        spans.append((s, e, m.group(1)))
    for o, e, cname in reversed(spans):
        block = js[o:e]
        lines = block.split('\n')
        inst, stat = set(), set()
        for l in lines:
            fm = re.match(r'^\s*static\s+([A-Za-z_]\w*)\s*(?:=|;|\s*$)', l)
            if fm and fm.group(1) not in KEYWORDS: stat.add(fm.group(1))
            fm2 = re.match(r'^\s*([A-Za-z_]\w*)\s*;\s*$', l)
            if fm2 and fm2.group(1) not in KEYWORDS: inst.add(fm2.group(1))
            fm3 = re.match(r'^\s*([A-Za-z_]\w*)\s*=\s*(\[\s*\]|\{\s*\}|new\s|CS\.newArr)', l)
            if fm3 and fm3.group(1) not in KEYWORDS: inst.add(fm3.group(1))
        static_methods = set(re.findall(r'(?m)^\s*static\s+\*?([A-Za-z_]\w*)\s*\(', block))
        out = []
        for l in lines:
            head = ''
            rest = l
            # 方法/构造声明：保护到参数列表结束
            fm2 = re.match(r'^(\s*(?:static\s+)?\*?)([A-Za-z_]\w*)(\s*\([^)]*\)\s*\{?\s*)$', l)
            if fm2 and fm2.group(2) not in KEYWORDS:
                head, rest = l, ''
            else:
                fm1 = re.match(r'^(\s*(?:static\s+)?)([A-Za-z_]\w*)(\s*(?:=\s*.*|;))$', l)
                if fm1 and fm1.group(2) in (inst | stat) and '==' not in l:
                    head, rest = l[:fm1.end(2)], l[fm1.end(2):]
            # 本行 let/const 声明的名字不是字段引用，整行排除
            excluded = set(re.findall(r'\blet\s+([A-Za-z_]\w*)\s+of\b', l))
            excluded |= set(re.findall(r'\blet\s+([A-Za-z_]\w*)\s*(?:=|;|,)', l))
            excluded |= set(re.findall(r'\b(?:const|var)\s+([A-Za-z_]\w*)\s*(?:=|;|,)', l))
            for ml in re.finditer(r'\blet\s+([^;]*);', l):
                for part in ml.group(1).split(','):
                    mm = re.match(r'^\s*([A-Za-z_]\w*)\s*=(?!=)', part)
                    if mm: excluded.add(mm.group(1))
            # lambda 参数：x => ... / (a, b) => ...
            excluded |= set(re.findall(r'\b([A-Za-z_]\w*)\s*=>', l))
            # 方法/构造声明行的参数名不是字段引用
            md = re.match(r'^\s*(?:static\s+)?(?:constructor|[A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{', l)
            if md and not l.lstrip().startswith(('if', 'for', 'while', 'switch', 'catch', 'return', 'foreach')):
                for p in md.group(1).split(','):
                    mm = re.match(r'^(?:\.\.\.)?([A-Za-z_]\w*)', p.strip())
                    if mm: excluded.add(mm.group(1))
            for grp in re.findall(r'\(([^)]*)\)\s*=>', l):
                for p in grp.split(','):
                    p = re.sub(r'^\s*(?:let\s+)?', '', p.strip())
                    if re.match(r'^[A-Za-z_]\w*$', p): excluded.add(p)
            rest, saved = mask(rest)
            for n in sorted(stat - excluded, key=len, reverse=True):
                rest = re.sub(r'(?<![\w.])' + re.escape(n) + r'\b', cname + '.' + n, rest)
            for n in sorted(inst - excluded, key=len, reverse=True):
                rest = re.sub(r'(?<![\w.])' + re.escape(n) + r'\b', 'this.' + n, rest)
            for n in static_methods:
                rest = re.sub(r'\bthis\.' + re.escape(n) + r'\(', cname + '.' + n + '(', rest)
                rest = re.sub(r'(?<![\w.])' + re.escape(n) + r'\b(?!\s*\()', cname + '.' + n, rest)
            out.append(head + unmask(rest, saved))
        js = js[:o] + '\n'.join(out) + js[e:]
    return js


BASE_PROPS = ('Id', 'Renderer', 'MinSeats', 'MaxSeats', 'Variants')


def bind_props(js):
    """C# 属性裸引用（return MinSeats; 等）→ this.X，保护 get X() 声明。"""
    out = []
    for line in js.split('\n'):
        def fix(seg):
            for p in BASE_PROPS:
                seg = re.sub(r'(?<![\w.])' + p + r'\b(?!\s*\()', 'this.' + p, seg)
            return seg
        m = re.match(r'^(\s*get\s+\w+\s*\(\s*\)\s*\{\s*)(.*)$', line)
        if m:
            out.append(m.group(1) + fix(m.group(2)))
        elif line.lstrip().startswith(('class ', '//', '/*', '*')):
            out.append(line)
        else:
            out.append(fix(line))
    return '\n'.join(out)


def disambiguate_overloads(js):
    """C# 允许同名重载，JS 不允许。DirectorGame 的
    private Dictionary Act(GameState, int) 与 IGameRule.Act(GameState,int,string,d) 重名，
    后者会覆盖前者导致剧本局取幕信息时落进错方法。把 2 参重载改名 ActInfo 并改调用点。"""
    m = re.search(r'(?m)^\s*class\s+DirectorGame\b', js)
    if not m: return js
    start = m.start()
    nxt = re.search(r'(?m)^\s*class\s+\w+', js[start + 10:])
    end = start + 10 + nxt.start() if nxt else len(js)
    block = js[start:end]
    block = re.sub(r'(?m)^(\s*)Act\(s, i\)', r'\1ActInfo(s, i)', block)
    block = block.replace('this.Act(s, this.IntV(s, "act", 0))',
                          'this.ActInfo(s, this.IntV(s, "act", 0))')
    return js[:start] + block + js[end:]


def inject_super(js):
    """C# 派生类构造无 super 概念；JS extends 必须先 super()。"""
    for m in reversed(list(re.finditer(r'(?m)^(\s*)class\s+\w+\s+extends\s+\w+\s*\{', js))):
        o = js.index('{', m.start())
        e = find_close(js, o)
        block = js[o:e + 1]
        block = re.sub(r'(?m)^(\s*constructor\s*\([^)]*\)\s*\{\s*)', r'\1super(); ', block)
        block = re.sub(r'(?m)^(\s*constructor\s*\([^)]*\)\s*\n)(\s*\{\s*\n)',
                       r'\1\2        super();\n', block)
        js = js[:o] + block + js[e + 1:]
    return js


def main():
    parts = []
    for f in FILES:
        src = strip_wrappers((SRC / f).read_text(encoding='utf-8'))
        for c in SKIP_CLASSES:
            src = remove_class(src, c)
        src = convert_list_ctors(src)
        src = convert_array_inits(src)
        src = convert_dict_inits(src)
        src = convert_brace_arrays(src)
        src = convert_getters(src)
        body = '\n'.join(translate_line(l) for l in src.split('\n'))
        parts.append('// ===== %s =====\n%s' % (f, body))

    body = inject_super(disambiguate_overloads(bind_props(bind_fields(bind_this_methods('\n\n'.join(parts))))))
    header = """/* 由 tools/cs2js.py 从 server/Rules/*.cs 定向转译，勿手改。
 * 60 局全部登记在同目录 registry.js；验收见 tools/rules-vector.test.mjs
 * 与 tools/rules-all.test.mjs。运行时语义由 cs-runtime.js 吸收。
 */
import { GameState, MoveResult, RuleBase, Cfg, DIRS } from './base.js';
import { CS, J } from './cs-runtime.js';

"""
    footer = """

/* ===== 与 server/Rules/RuleRegistry.cs 一一对应的 60 局 ===== */
const MAP = {};
const ORDER = [];
function Add(r) { MAP[r.Id] = r; ORDER.push(r.Id); }

Add(new XiangqiGame());
Add(new DarkGame('jieqi'));
Add(new DarkGame('xiangqidark'));
Add(new DarkGame('junqi'));
Add(new DarkGame('doushou'));
Add(new ChessGame('chess'));
Add(new ChessGame('chess960'));
Add(new ShogiGame());
Add(new GoGame());
Add(new LineGame('gomoku'));
Add(new LineGame('renju'));
Add(new LineGame('connect6'));
Add(new LineGame('connect4'));
Add(new LineGame('tictactoe'));
Add(new OthelloGame());
Add(new CheckersGame());
Add(new HexJumpGame());
Add(new MillsGame());
Add(new TrickGame('doudizhu'));
Add(new TrickGame('doudizhu2'));
Add(new TrickGame('laizi'));
Add(new TrickGame('guandan'));
Add(new TrickGame('shengji'));
Add(new TrickGame('paodekuai'));
Add(new TrickGame('gongzhu'));
Add(new TrickGame('hongshi'));
Add(new ShowdownGame('shisanszhang'));
Add(new UnoGame());
Add(new BridgeGame());
Add(new MahjongGame());
Add(new FlightGame());
Add(new MonopolyGame());
Add(new WerewolfGame());
Add(new UndercoverGame());
Add(new Point24Game());
Add(new SolitaireGame());
Add(new ExtraGame('dots'));
Add(new ExtraGame('hex'));
Add(new ExtraGame('nim'));
Add(new ExtraGame('endgame'));
Add(new ExtraGame('junqi4'));
Add(new ExtraGame('gouji'));
Add(new ExtraGame('baohuang'));
Add(new ExtraGame('chudadi'));
Add(new ExtraGame('shuangkou'));
Add(new ExtraGame('avalon'));
Add(new ExtraGame('turtlesoup'));
Add(new ExtraGame('mastermind'));
Add(new ExtraGame('drawguess'));
Add(new DirectorGame());
Add(new PeakGame());
Add(new TournamentGame());
Add(new YiJuanGame());
Add(new OrigSevenGame('houlou'));
Add(new OrigSevenGame('duzhou'));
Add(new OrigSevenGame('dengying'));
Add(new OrigSevenGame('huiwen'));
Add(new OrigSevenGame('cuojin'));
Add(new OrigSevenGame('shiyi'));
Add(new OrigSevenGame('tingyu'));

export const RuleRegistry = {
  Get: id => MAP[id] || null,
  get Ids() { return ORDER.slice(); },
  get Count() { return ORDER.length; },
  get Fallback() { return MAP['xiangqi']; }
};
export { MAP as RULES };
"""
    OUT.write_text(header + body + footer, encoding='utf-8')
    print('写出', OUT.name, len((header + body + footer).split('\n')), '行')


if __name__ == '__main__':
    main()
