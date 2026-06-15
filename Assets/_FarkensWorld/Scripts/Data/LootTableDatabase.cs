using System;
using System.Collections.Generic;

namespace FarkensWorld
{
    [Serializable]
    public sealed class LootEntry
    {
        public string itemId;
        public int min;
        public int max;
        public float chance;

        public LootEntry(string id, int minimum, int maximum, float dropChance)
        {
            itemId = id;
            min = minimum;
            max = maximum;
            chance = dropChance;
        }
    }

    public static class LootTableDatabase
    {
        private static readonly Dictionary<LootContainerType, LootEntry[]> Tables = new Dictionary<LootContainerType, LootEntry[]>
        {
            [LootContainerType.YellowBarrel] = new[]
            {
                E("scrap", 2, 8, 0.9f), E("metalFragments", 4, 16, 0.65f), E("rope", 1, 2, 0.25f),
                E("tarp", 1, 2, 0.18f), E("sewingKit", 1, 2, 0.16f), E("roadSigns", 1, 2, 0.2f), E("metalBlade", 1, 1, 0.15f)
            },
            [LootContainerType.RedBarrel] = new[] { E("lowGradeFuel", 5, 18, 1f), E("crudeOil", 4, 14, 0.85f) },
            [LootContainerType.BlueBarrel] = new[]
            {
                E("scrap", 3, 10, 0.9f), E("metalFragments", 8, 24, 0.8f), E("gears", 1, 2, 0.2f),
                E("metalPipe", 1, 2, 0.22f), E("metalSpring", 1, 2, 0.18f), E("sheetMetal", 1, 2, 0.2f), E("electricFuse", 1, 1, 0.16f)
            },
            [LootContainerType.WoodenCrate] = new[]
            {
                E("scrap", 4, 14, 0.85f), E("cloth", 6, 20, 0.55f), E("rope", 1, 3, 0.35f),
                E("waterBottle", 1, 2, 0.32f), E("mushroom", 1, 4, 0.42f), E("bandage", 1, 2, 0.24f)
            },
            [LootContainerType.MilitaryCrate] = new[]
            {
                E("scrap", 12, 32, 1f), E("metalFragments", 20, 60, 0.9f), E("lowGradeFuel", 5, 18, 0.55f),
                E("gears", 1, 3, 0.48f), E("metalPipe", 1, 3, 0.5f), E("metalSpring", 1, 2, 0.42f),
                E("sheetMetal", 1, 3, 0.45f), E("electricFuse", 1, 2, 0.38f), E("bandage", 1, 3, 0.58f)
            },
            [LootContainerType.FoodCrate] = new[]
            {
                E("mushroom", 2, 6, 0.9f), E("cookedMeat", 1, 4, 0.72f), E("waterBottle", 1, 3, 0.78f), E("bandage", 1, 1, 0.16f)
            },
            [LootContainerType.Toolbox] = new[]
            {
                E("metalBlade", 1, 2, 0.5f), E("gears", 1, 2, 0.42f), E("metalPipe", 1, 3, 0.58f),
                E("metalSpring", 1, 2, 0.38f), E("rope", 1, 3, 0.52f)
            }
        };

        public static List<InventorySlot> Roll(LootContainerType type, System.Random random)
        {
            List<InventorySlot> loot = new List<InventorySlot>();
            if (!Tables.TryGetValue(type, out LootEntry[] entries)) return loot;
            for (int i = 0; i < entries.Length; i++)
            {
                LootEntry entry = entries[i];
                if (random.NextDouble() > entry.chance) continue;
                loot.Add(new InventorySlot(entry.itemId, random.Next(entry.min, entry.max + 1)));
            }
            if (loot.Count == 0 && entries.Length > 0)
            {
                LootEntry fallback = entries[0];
                loot.Add(new InventorySlot(fallback.itemId, random.Next(fallback.min, fallback.max + 1)));
            }
            return loot;
        }

        private static LootEntry E(string id, int min, int max, float chance) => new LootEntry(id, min, max, chance);
    }
}
