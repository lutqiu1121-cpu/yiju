using System;
using System.Collections.Generic;
using System.Linq;

namespace Qipai
{

    public static class RuleRegistry
    {
        private static readonly Dictionary<string, IGameRule> map = new Dictionary<string, IGameRule>();
        private static readonly List<string> order = new List<string>();

        static RuleRegistry()
        {
            Add(new XiangqiGame());

            Add(new DarkGame("jieqi"));
            Add(new DarkGame("xiangqidark"));
            Add(new DarkGame("junqi"));
            Add(new DarkGame("doushou"));

            Add(new ChessGame("chess"));
            Add(new ChessGame("chess960"));
            Add(new ShogiGame());

            Add(new GoGame());

            Add(new LineGame("gomoku"));
            Add(new LineGame("renju"));
            Add(new LineGame("connect6"));
            Add(new LineGame("connect4"));
            Add(new LineGame("tictactoe"));

            Add(new OthelloGame());
            Add(new CheckersGame());
            Add(new HexJumpGame());
            Add(new MillsGame());

            Add(new TrickGame("doudizhu"));
            Add(new TrickGame("doudizhu2"));
            Add(new TrickGame("laizi"));
            Add(new TrickGame("guandan"));
            Add(new TrickGame("shengji"));
            Add(new TrickGame("paodekuai"));
            Add(new TrickGame("gongzhu"));
            Add(new TrickGame("hongshi"));

            Add(new ShowdownGame("texas"));
            Add(new ShowdownGame("zhajinhua"));
            Add(new ShowdownGame("niuniu"));
            Add(new ShowdownGame("sangong"));
            Add(new ShowdownGame("shisanszhang"));

            Add(new UnoGame());
            Add(new BridgeGame());
            Add(new MahjongGame());

            Add(new FlightGame());
            Add(new MonopolyGame());
            Add(new WerewolfGame());
            Add(new UndercoverGame());
            Add(new Point24Game());
            Add(new SolitaireGame());

            Add(new ExtraGame("dots"));
            Add(new ExtraGame("hex"));
            Add(new ExtraGame("nim"));
            Add(new ExtraGame("endgame"));
            Add(new ExtraGame("junqi4"));
            Add(new ExtraGame("gouji"));
            Add(new ExtraGame("baohuang"));
            Add(new ExtraGame("chudadi"));
            Add(new ExtraGame("shuangkou"));
            Add(new ExtraGame("showhand"));
            Add(new ExtraGame("blackjack"));
            Add(new ExtraGame("liarsdice"));
            Add(new ExtraGame("avalon"));
            Add(new ExtraGame("turtlesoup"));
            Add(new ExtraGame("mastermind"));
            Add(new ExtraGame("drawguess"));
            Add(new DirectorGame());
            Add(new PeakGame());
            Add(new TournamentGame());
            Add(new YiJuanGame());
        }

        private static void Add(IGameRule r)
        {
            map[r.Id] = r;
            order.Add(r.Id);
        }
        public static IGameRule Get(string id)
        {
            IGameRule r;
            return id != null && map.TryGetValue(id, out r) ? r : null;
        }
        public static string[] Ids { get { return order.ToArray(); } }
        public static int Count { get { return order.Count; } }
        public static IGameRule Fallback { get { return map["xiangqi"]; } }
    }
}
