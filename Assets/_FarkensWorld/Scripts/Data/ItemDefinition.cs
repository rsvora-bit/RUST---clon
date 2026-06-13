using UnityEngine;

namespace FarkensWorld
{
    public enum ItemCategory
    {
        Tools,
        Weapons,
        Resources,
        Components,
        Food,
        Medical,
        Build,
        Misc
    }

    public sealed class ItemDefinition
    {
        public string Id { get; private set; }
        public string DisplayName { get; private set; }
        public string ShortName { get; private set; }
        public ItemCategory Category { get; private set; }
        public int StackLimit { get; private set; }
        public int MaxDurability { get; private set; }
        public Color WorldColor { get; private set; }

        public bool IsDurable => MaxDurability > 0;

        public ItemDefinition(
            string id,
            string displayName,
            string shortName,
            ItemCategory category,
            int stackLimit,
            Color worldColor,
            int maxDurability = 0)
        {
            Id = id;
            DisplayName = displayName;
            ShortName = shortName;
            Category = category;
            StackLimit = Mathf.Max(1, stackLimit);
            MaxDurability = Mathf.Max(0, maxDurability);
            WorldColor = worldColor;
        }
    }
}
