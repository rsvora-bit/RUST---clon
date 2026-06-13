using System;

namespace FarkensWorld
{
    public static class GameEvents
    {
        public static event Action InventoryChanged;
        public static event Action HotbarChanged;
        public static event Action<string> FeedMessage;
        public static event Action<string> CenterMessage;

        public static void RaiseInventoryChanged() => InventoryChanged?.Invoke();
        public static void RaiseHotbarChanged() => HotbarChanged?.Invoke();
        public static void RaiseFeed(string message) => FeedMessage?.Invoke(message);
        public static void RaiseCenter(string message) => CenterMessage?.Invoke(message);
    }
}
