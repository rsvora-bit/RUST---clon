using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public enum BuildPieceType
    {
        Foundation,
        Wall,
        Doorframe,
        Roof,
        Campfire,
        StorageBox,
        Furnace,
        Workbench,
        SleepingBag,
        Workbench2,
        Workbench3
    }

    public sealed class BuildPieceDefinition
    {
        public BuildPieceType Type { get; private set; }
        public string DisplayName { get; private set; }
        public Vector3 Size { get; private set; }
        public IReadOnlyDictionary<string, int> Cost { get; private set; }

        public BuildPieceDefinition(BuildPieceType type, string displayName, Vector3 size, Dictionary<string, int> cost)
        {
            Type = type;
            DisplayName = displayName;
            Size = size;
            Cost = cost;
        }
    }

    public static class BuildPieceDatabase
    {
        private static readonly List<BuildPieceDefinition> Definitions = new List<BuildPieceDefinition>
        {
            Build(BuildPieceType.Foundation, "Foundation", new Vector3(6f, 0.45f, 6f), "wood", 90),
            Build(BuildPieceType.Wall, "Wall", new Vector3(6f, 3.2f, 0.35f), "wood", 55),
            Build(BuildPieceType.Doorframe, "Doorframe", new Vector3(6f, 3.2f, 0.35f), "wood", 65),
            Build(BuildPieceType.Roof, "Roof", new Vector3(6f, 0.35f, 6f), "wood", 70),
            Build(BuildPieceType.Campfire, "Campfire", new Vector3(1.7f, 0.5f, 1.7f), "campfire", 1),
            Build(BuildPieceType.StorageBox, "Storage Box", new Vector3(1.8f, 1.1f, 1.2f), "storageBox", 1),
            Build(BuildPieceType.Furnace, "Furnace", new Vector3(1.8f, 2f, 1.8f), "furnace", 1),
            Build(BuildPieceType.Workbench, "Workbench L1", new Vector3(2.7f, 1.4f, 1.4f), "workbench1", 1),
            Build(BuildPieceType.Workbench2, "Workbench L2", new Vector3(2.7f, 1.4f, 1.4f), "workbench2", 1),
            Build(BuildPieceType.Workbench3, "Workbench L3", new Vector3(2.7f, 1.4f, 1.4f), "workbench3", 1),
            Build(BuildPieceType.SleepingBag, "Sleeping Bag", new Vector3(2.2f, 0.25f, 0.9f), "sleepingBag", 1)
        };

        public static IReadOnlyList<BuildPieceDefinition> All => Definitions;

        public static BuildPieceDefinition Get(BuildPieceType type)
        {
            return Definitions.Find(definition => definition.Type == type);
        }

        private static BuildPieceDefinition Build(BuildPieceType type, string name, Vector3 size, string itemId, int amount)
        {
            return new BuildPieceDefinition(type, name, size, new Dictionary<string, int> { { itemId, amount } });
        }
    }
}
