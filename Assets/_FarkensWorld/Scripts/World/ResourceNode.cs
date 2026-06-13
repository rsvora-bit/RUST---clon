using UnityEngine;

namespace FarkensWorld
{
    public enum ResourceNodeType
    {
        Tree,
        Stone,
        MetalOre,
        SulfurOre
    }

    public sealed class ResourceNode : MonoBehaviour
    {
        [SerializeField] private ResourceNodeType type;
        [SerializeField] private float health = 100f;
        [SerializeField] private int baseYield = 10;

        public ResourceNodeType Type => type;

        public void Configure(ResourceNodeType nodeType, float nodeHealth, int yield)
        {
            type = nodeType;
            health = nodeHealth;
            baseYield = yield;
        }

        public void Harvest(string toolId, DroppedItemWorldSpawner spawner)
        {
            float damage = 12f;
            float yieldMultiplier = 1f;

            if (toolId == "hatchet")
            {
                damage = 28f;
                yieldMultiplier = type == ResourceNodeType.Tree ? 1.8f : 0.8f;
            }
            else if (toolId == "pickaxe")
            {
                damage = 27f;
                yieldMultiplier = type == ResourceNodeType.Tree ? 0.75f : 1.9f;
            }
            else if (toolId == "spear")
            {
                damage = 18f;
                yieldMultiplier = 0.7f;
            }

            health -= damage;
            int amount = Mathf.Max(1, Mathf.RoundToInt(baseYield * yieldMultiplier));
            string itemId = GetYieldItem();
            spawner.Spawn(itemId, amount, transform.position + Vector3.up * 1.1f + Random.insideUnitSphere * 0.45f);
            GameEvents.RaiseFeed("Hit " + type + ": +" + amount + " " + itemId + " dropped");
            transform.localScale *= 0.985f;

            if (health <= 0f)
            {
                spawner.Spawn(itemId, amount * 2, transform.position + Vector3.up);
                Destroy(gameObject);
            }
        }

        private string GetYieldItem()
        {
            switch (type)
            {
                case ResourceNodeType.Tree: return "wood";
                case ResourceNodeType.MetalOre: return "metalOre";
                case ResourceNodeType.SulfurOre: return "sulfurOre";
                default: return "stone";
            }
        }
    }
}
