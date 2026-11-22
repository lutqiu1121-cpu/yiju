package app.yiju.archive;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * 极简 WebView 壳，零第三方依赖。
 *
 * 关键：不能用 file:///android_asset/client/index.html 加载。
 * index.html 用 <script type="module">，file:// 下 origin 为 null，
 * WebView 会以 CORS 为由拒载 app.js，整个前端脚本一行不执行
 * （页面停在静态占位的 40 局 / 候馆中，所有按钮无绑定）。
 *
 * 改用虚拟安全源 https://yiju.local/ + shouldInterceptRequest 把请求
 * 映射到 assets/client/，module 与 fetch 都获得正常同源，无需改前端源码。
 */
public class MainActivity extends Activity {

    private static final String HOST = "yiju.local";
    private static final String ENTRY = "https://" + HOST + "/client/index.html";
    private static final int PAPER = 0xFFF4F0E6;

    private WebView web;
    private View splash;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(PAPER);

        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        // 浅色过渡层：与桌面图标、内页同为米白纸色，点开不割裂
        FrameLayout cover = new FrameLayout(this);
        cover.setBackgroundColor(PAPER);
        TextView mark = new TextView(this);
        mark.setText("弈");
        mark.setTextColor(0xFF2B2A26);
        mark.setTextSize(56);
        mark.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams mp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        mp.gravity = Gravity.CENTER;
        cover.addView(mark, mp);
        TextView sub = new TextView(this);
        sub.setText("离线棋馆 · 开枰");
        sub.setTextColor(0xFF6D685C);
        sub.setTextSize(12);
        sub.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        sp.gravity = Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM;
        sp.bottomMargin = 96;
        cover.addView(sub, sp);
        splash = cover;
        root.addView(cover, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);                  // ES module、fetch、Canvas 全靠它
        s.setDomStorageEnabled(true);                  // 主题 / 昵称 / 战绩 / 本地存档
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);  // WebAudio 合成音效
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        web.setBackgroundColor(PAPER);
        web.setWebViewClient(new AssetClient());
        web.loadUrl(ENTRY);
    }

    private void fadeSplash() {
        if (splash == null) return;
        final View v = splash;
        splash = null;
        v.animate().alpha(0f).setDuration(260).withEndAction(new Runnable() {
            @Override public void run() {
                FrameLayout parent = (FrameLayout) v.getParent();
                if (parent != null) parent.removeView(v);
            }
        }).start();
    }

    private String mime(String p) {
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    private WebResourceResponse serve(Uri u) {
        if (u == null || !HOST.equals(u.getHost())) return null;  // 放行真实网络请求
        String path = u.getPath();
        if (path == null || path.equals("/") || path.isEmpty()) path = "/client/index.html";
        if (path.contains("..")) return null;
        if (path.startsWith("/ws") || path.startsWith("/api/")) return null;
        String rel = path.startsWith("/") ? path.substring(1) : path;
        if (!rel.startsWith("client/")) rel = "client/" + rel;   // 兼容 /rules/... 绝对路径写法
        try {
            InputStream in = getAssets().open(rel);
            Map<String, String> h = new HashMap<>();
            h.put("Access-Control-Allow-Origin", "*");
            h.put("Cache-Control", "no-store");
            return new WebResourceResponse(mime(rel), "utf-8", 200, "OK", h, in);
        } catch (Exception e) {
            return null;   // 交给 WebView 默认处理，不伪造空白页
        }
    }

    private class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return null;
            return serve(req.getUrl());
        }

        @SuppressWarnings("deprecation")
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            return serve(Uri.parse(url));
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            fadeSplash();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
