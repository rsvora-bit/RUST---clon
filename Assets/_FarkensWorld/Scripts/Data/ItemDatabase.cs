using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public static class ItemDatabase
    {
        private static readonly Dictionary<string, ItemDefinition> Items = new Dictionary<string, ItemDefinition>();
        private static bool initialized;

        public static IEnumerable<ItemDefinition> All
        {
            get
            {
                EnsureInitialized();
                return Items.Values;
            }
        }

        public static ItemDefinition Get(string id)
        {
            EnsureInitialized();
            ItemDefinition item;
            return !string.IsNullOrEmpty(id) && Items.TryGetValue(id, out item) ? item : null;
        }

        public static bool Contains(string id)
        {
            return Get(id) != null;
        }

        private static void EnsureInitialized()
        {
            if (initialized)
            {
                return;
            }

            initialized = true;
            Color wood = new Color(0.45f, 0.25f, 0.09f);
            Color stone = new Color(0.48f, 0.51f, 0.52f);
            Color metal = new Color(0.45f, 0.57f, 0.64f);
            Color sulfur = new Color(0.88f, 0.72f, 0.12f);
            Color cloth = new Color(0.78f, 0.72f, 0.62f);
            Color food = new Color(0.48f, 0.68f, 0.24f);
            Color medical = new Color(0.82f, 0.18f, 0.18f);
            Color build = new Color(0.75f, 0.5f, 0.18f);

            Add("wood", "Wood", "WOOD", ItemCategory.Resources, 1000, wood);
            Add("stone", "Stone", "STONE", ItemCategory.Resources, 1000, stone);
            Add("metalOre", "Metal Ore", "M.ORE", ItemCategory.Resources, 1000, metal);
            Add("sulfurOre", "Sulfur Ore", "S.ORE", ItemCategory.Resources, 1000, sulfur);
            Add("sulfur", "Sulfur", "SULFUR", ItemCategory.Resources, 1000, sulfur);
            Add("metalFragments", "Metal Fragments", "FRAGS", ItemCategory.Resources, 1000, metal);
            Add("cloth", "Cloth", "CLOTH", ItemCategory.Resources, 500, cloth);
            Add("scrap", "Scrap", "SCRAP", ItemCategory.Components, 500, new Color(0.55f, 0.65f, 0.58f));
            Add("lowGradeFuel", "Low Grade Fuel", "FUEL", ItemCategory.Components, 500, new Color(0.72f, 0.5f, 0.14f));
            Add("crudeOil", "Crude Oil", "OIL", ItemCategory.Components, 500, new Color(0.12f, 0.1f, 0.08f));
            Add("mushroom", "Mushroom", "FOOD", ItemCategory.Food, 20, food);
            Add("bandage", "Bandage", "MED", ItemCategory.Medical, 20, medical);
            Add("waterBottle", "Water Bottle", "WATER", ItemCategory.Food, 20, new Color(0.18f, 0.62f, 0.82f));
            Add("cookedMeat", "Cooked Meat", "MEAT", ItemCategory.Food, 20, new Color(0.62f, 0.25f, 0.16f));
            Add("animalFat", "Animal Fat", "FAT", ItemCategory.Resources, 100, new Color(0.88f, 0.83f, 0.62f));
            Add("leather", "Leather", "HIDE", ItemCategory.Resources, 100, new Color(0.45f, 0.25f, 0.12f));
            Add("rock", "Rock Tool", "ROCK", ItemCategory.Tools, 1, stone, 35);
            Add("torch", "Torch", "TORCH", ItemCategory.Tools, 1, wood, 80);
            Add("hatchet", "Stone Hatchet", "AXE", ItemCategory.Tools, 1, stone, 120);
            Add("pickaxe", "Stone Pickaxe", "PICK", ItemCategory.Tools, 1, stone, 110);
            Add("spear", "Wooden Spear", "SPEAR", ItemCategory.Weapons, 1, wood, 90);
            Add("bow", "Hunting Bow", "BOW", ItemCategory.Weapons, 1, wood, 65);
            Add("arrow", "Arrow", "ARROW", ItemCategory.Weapons, 64, wood);
            Add("buildingPlan", "Building Plan", "PLAN", ItemCategory.Tools, 1, build, 200);
            Add("campfire", "Campfire", "FIRE", ItemCategory.Build, 1, build);
            Add("furnace", "Furnace", "FURN", ItemCategory.Build, 1, stone);
            Add("workbench1", "Workbench Level 1", "WB1", ItemCategory.Build, 1, build);
            Add("workbench2", "Workbench Level 2", "WB2", ItemCategory.Build, 1, metal);
            Add("workbench3", "Workbench Level 3", "WB3", ItemCategory.Build, 1, metal);
            Add("sleepingBag", "Sleeping Bag", "BAG", ItemCategory.Build, 1, cloth);
            Add("storageBox", "Storage Box", "BOX", ItemCategory.Build, 1, wood);
            Add("foundation", "Foundation", "FOUND", ItemCategory.Build, 20, wood);
            Add("wall", "Wall", "WALL", ItemCategory.Build, 20, wood);
            Add("doorframe", "Doorframe", "DOOR", ItemCategory.Build, 20, wood);
            Add("roof", "Roof", "ROOF", ItemCategory.Build, 20, wood);
            Add("metalBlade", "Metal Blade", "BLADE", ItemCategory.Components, 20, metal);
            Add("rope", "Rope", "ROPE", ItemCategory.Components, 20, cloth);
            Add("emptyPropaneTank", "Empty Propane Tank", "TANK", ItemCategory.Components, 20, metal);
            Add("sewingKit", "Sewing Kit", "SEW", ItemCategory.Components, 20, metal);
            Add("tarp", "Tarp", "TARP", ItemCategory.Components, 20, cloth);
            Add("electricFuse", "Electric Fuse", "FUSE", ItemCategory.Components, 20, metal);
            Add("gears", "Gears", "GEARS", ItemCategory.Components, 20, metal);
            Add("metalPipe", "Metal Pipe", "PIPE", ItemCategory.Components, 20, metal);
            Add("metalSpring", "Metal Spring", "SPRING", ItemCategory.Components, 20, metal);
            Add("roadSigns", "Road Signs", "SIGNS", ItemCategory.Components, 20, metal);
            Add("sheetMetal", "Sheet Metal", "SHEET", ItemCategory.Components, 20, metal);
        }

        private static void Add(
            string id,
            string displayName,
            string shortName,
            ItemCategory category,
            int stackLimit,
            Color color,
            int durability = 0)
        {
            Items[id] = new ItemDefinition(id, displayName, shortName, category, stackLimit, color, durability);
        }
    }
}
