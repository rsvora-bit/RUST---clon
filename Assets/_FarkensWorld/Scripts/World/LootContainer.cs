using System;
using UnityEngine;

namespace FarkensWorld
{
    public enum LootContainerType
    {
        Barrel,
        Crate
    }

    public sealed class LootContainer : MonoBehaviour
    {
        [SerializeField] private LootContainerType type;
        [SerializeField] private float health = 45f;
        private int seed;

        public static LootContainer Create(Vector3 position, LootContainerType containerType, Material material, System.Random random, Transform parent)
        {
            GameObject root = new GameObject(containerType + " Loot");
            root.transform.SetParent(parent);
            root.transform.position = position;
            PrimitiveType shape = containerType == LootContainerType.Barrel ? PrimitiveType.Cylinder : PrimitiveType.Cube;
            Vector3 scale = containerType == LootContainerType.Barrel ? new Vector3(1.25f, 1.7f, 1.25f) : new Vector3(1.8f, 1.3f, 1.8f);
            WorldGenerator.Primitive("Body", shape, new Vector3(0f, scale.y * 0.5f, 0f), scale, material, root.transform);
            LootContainer container = root.AddComponent<LootContainer>();
            container.type = containerType;
            container.seed = random.Next();
            return container;
        }

        public void Hit(float damage)
        {
            health -= damage;
            if (health <= 0f)
            {
                DropLoot();
                Destroy(gameObject);
            }
        }

        private void DropLoot()
        {
            System.Random random = new System.Random(seed);
            string[] crateLoot = { "scrap", "cloth", "rope", "waterBottle", "mushroom", "bandage" };
            string[] barrelLoot = { "scrap", "metalFragments", "lowGradeFuel", "gears", "metalPipe", "roadSigns" };
            string[] table = type == LootContainerType.Crate ? crateLoot : barrelLoot;
            int count = random.Next(2, 5);
            for (int i = 0; i < count; i++)
            {
                string itemId = table[random.Next(table.Length)];
                int amount = itemId == "scrap" || itemId == "metalFragments" ? random.Next(4, 16) : random.Next(1, 4);
                GameManager.Instance.Drops.Spawn(itemId, amount, transform.position + Vector3.up + UnityEngine.Random.insideUnitSphere * 0.6f);
            }

            GameEvents.RaiseCenter(type + " destroyed - loot dropped");
        }
    }
}
