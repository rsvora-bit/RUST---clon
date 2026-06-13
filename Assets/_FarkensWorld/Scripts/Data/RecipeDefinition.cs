using System.Collections.Generic;

namespace FarkensWorld
{
    public sealed class RecipeDefinition
    {
        public string ResultItemId { get; private set; }
        public string DisplayName { get; private set; }
        public int Amount { get; private set; }
        public float CraftTime { get; private set; }
        public ItemCategory Category { get; private set; }
        public int RequiredWorkbenchLevel { get; private set; }
        public IReadOnlyDictionary<string, int> Cost { get; private set; }

        public RecipeDefinition(
            string resultItemId,
            string displayName,
            int amount,
            float craftTime,
            ItemCategory category,
            int requiredWorkbenchLevel,
            Dictionary<string, int> cost)
        {
            ResultItemId = resultItemId;
            DisplayName = displayName;
            Amount = amount;
            CraftTime = craftTime;
            Category = category;
            RequiredWorkbenchLevel = requiredWorkbenchLevel;
            Cost = cost;
        }
    }

    public static class CraftingDatabase
    {
        private static readonly List<RecipeDefinition> Recipes = new List<RecipeDefinition>
        {
            Recipe("bandage", "Bandage x2", 2, 1.5f, ItemCategory.Medical, 0, "cloth", 8),
            Recipe("arrow", "Arrows x6", 6, 2f, ItemCategory.Weapons, 0, "wood", 12, "cloth", 1),
            Recipe("hatchet", "Stone Hatchet", 1, 4f, ItemCategory.Tools, 0, "wood", 90, "stone", 55),
            Recipe("pickaxe", "Stone Pickaxe", 1, 4f, ItemCategory.Tools, 0, "wood", 80, "stone", 85),
            Recipe("spear", "Wooden Spear", 1, 3f, ItemCategory.Weapons, 0, "wood", 150),
            Recipe("bow", "Hunting Bow", 1, 5f, ItemCategory.Weapons, 1, "wood", 170, "cloth", 35),
            Recipe("campfire", "Campfire", 1, 4f, ItemCategory.Build, 0, "wood", 90, "stone", 30),
            Recipe("storageBox", "Storage Box", 1, 5f, ItemCategory.Build, 0, "wood", 120),
            Recipe("sleepingBag", "Sleeping Bag", 1, 5f, ItemCategory.Build, 0, "cloth", 35),
            Recipe("furnace", "Furnace", 1, 8f, ItemCategory.Build, 0, "stone", 160, "lowGradeFuel", 4),
            Recipe("workbench1", "Workbench Level 1", 1, 8f, ItemCategory.Build, 0, "wood", 250, "scrap", 50, "metalFragments", 75),
            Recipe("workbench2", "Workbench Level 2", 1, 10f, ItemCategory.Build, 1, "scrap", 250, "metalFragments", 500, "gears", 5),
            Recipe("workbench3", "Workbench Level 3", 1, 12f, ItemCategory.Build, 2, "scrap", 500, "metalFragments", 1000, "gears", 10, "metalPipe", 5)
        };

        public static IReadOnlyList<RecipeDefinition> All => Recipes;

        public static RecipeDefinition Get(string itemId)
        {
            return Recipes.Find(recipe => recipe.ResultItemId == itemId);
        }

        private static RecipeDefinition Recipe(
            string id,
            string name,
            int amount,
            float time,
            ItemCategory category,
            int workbench,
            params object[] costs)
        {
            Dictionary<string, int> cost = new Dictionary<string, int>();
            for (int i = 0; i + 1 < costs.Length; i += 2)
            {
                cost[(string)costs[i]] = (int)costs[i + 1];
            }

            return new RecipeDefinition(id, name, amount, time, category, workbench, cost);
        }
    }
}
