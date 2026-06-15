using System;
using UnityEngine;

namespace FarkensWorld
{
    public enum LootContainerType
    {
        YellowBarrel,
        RedBarrel,
        BlueBarrel,
        WoodenCrate,
        MilitaryCrate,
        FoodCrate,
        Toolbox
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
            bool barrel = containerType == LootContainerType.YellowBarrel || containerType == LootContainerType.RedBarrel || containerType == LootContainerType.BlueBarrel;
            PrimitiveType shape = barrel ? PrimitiveType.Cylinder : PrimitiveType.Cube;
            Vector3 scale = barrel ? new Vector3(1.25f, 1.7f, 1.25f) : containerType == LootContainerType.Toolbox ? new Vector3(1.6f, 0.7f, 0.9f) : new Vector3(1.8f, 1.3f, 1.8f);
            Material coloredMaterial = WorldGenerator.CreateMaterial(containerType + " Material", ContainerColor(containerType), 0.88f, barrel ? 0.16f : 0f);
            WorldGenerator.Primitive("Body", shape, new Vector3(0f, scale.y * 0.5f, 0f), scale, coloredMaterial == null ? material : coloredMaterial, root.transform);
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
            foreach (InventorySlot slot in LootTableDatabase.Roll(type, random))
            {
                GameManager.Instance.Drops.Spawn(slot.itemId, slot.amount, transform.position + Vector3.up + UnityEngine.Random.insideUnitSphere * 0.6f, slot.durability);
            }

            GameManager.Instance.Audio.Play(AudioCue.Break, UnityEngine.Random.Range(0.86f, 1.05f));

            GameEvents.RaiseCenter(type + " destroyed - loot dropped");
        }

        private static Color ContainerColor(LootContainerType value)
        {
            switch (value)
            {
                case LootContainerType.YellowBarrel: return new Color(0.72f, 0.55f, 0.12f);
                case LootContainerType.RedBarrel: return new Color(0.68f, 0.12f, 0.08f);
                case LootContainerType.BlueBarrel: return new Color(0.08f, 0.34f, 0.58f);
                case LootContainerType.MilitaryCrate: return new Color(0.19f, 0.28f, 0.17f);
                case LootContainerType.FoodCrate: return new Color(0.31f, 0.48f, 0.16f);
                case LootContainerType.Toolbox: return new Color(0.12f, 0.31f, 0.43f);
                default: return new Color(0.46f, 0.29f, 0.13f);
            }
        }
    }
}
