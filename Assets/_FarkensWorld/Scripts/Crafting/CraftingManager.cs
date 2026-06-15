using System;
using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    [Serializable]
    public sealed class CraftingQueueItem
    {
        public string recipeId;
        public float remaining;
        public float total;
    }

    public sealed class CraftingManager : MonoBehaviour
    {
        private readonly List<CraftingQueueItem> queue = new List<CraftingQueueItem>();

        public IReadOnlyList<CraftingQueueItem> Queue => queue;

        private void Update()
        {
            if (queue.Count == 0)
            {
                return;
            }

            CraftingQueueItem current = queue[0];
            current.remaining -= Time.deltaTime;
            if (current.remaining <= 0f)
            {
                Complete(current);
                queue.RemoveAt(0);
            }
        }

        public bool CanCraft(RecipeDefinition recipe)
        {
            if (recipe == null || GameManager.Instance.Building.GetNearbyWorkbenchLevel() < recipe.RequiredWorkbenchLevel)
            {
                return false;
            }

            foreach (KeyValuePair<string, int> cost in recipe.Cost)
            {
                if (GameManager.Instance.PlayerInventory.Count(cost.Key) < cost.Value)
                {
                    return false;
                }
            }

            return true;
        }

        public bool QueueCraft(RecipeDefinition recipe)
        {
            if (!CanCraft(recipe))
            {
                GameEvents.RaiseCenter("Missing resources or workbench level");
                return false;
            }

            foreach (KeyValuePair<string, int> cost in recipe.Cost)
            {
                GameManager.Instance.PlayerInventory.Remove(cost.Key, cost.Value);
            }

            queue.Add(new CraftingQueueItem
            {
                recipeId = recipe.ResultItemId,
                remaining = recipe.CraftTime,
                total = recipe.CraftTime
            });
            GameEvents.RaiseFeed("Crafting started: " + recipe.DisplayName);
            GameManager.Instance.Audio.Play(AudioCue.CraftStart, UnityEngine.Random.Range(0.95f, 1.05f));
            return true;
        }

        public void Cancel(int index)
        {
            if (index < 0 || index >= queue.Count)
            {
                return;
            }

            RecipeDefinition recipe = CraftingDatabase.Get(queue[index].recipeId);
            if (recipe != null)
            {
                foreach (KeyValuePair<string, int> cost in recipe.Cost)
                {
                    GameManager.Instance.PlayerInventory.Add(cost.Key, cost.Value);
                }
            }

            queue.RemoveAt(index);
        }

        private static void Complete(CraftingQueueItem item)
        {
            RecipeDefinition recipe = CraftingDatabase.Get(item.recipeId);
            if (recipe == null)
            {
                return;
            }

            int remainder = GameManager.Instance.PlayerInventory.Add(recipe.ResultItemId, recipe.Amount);
            if (remainder > 0)
            {
                Vector3 position = GameManager.Instance.PlayerController.transform.position + GameManager.Instance.PlayerController.transform.forward * 1.5f + Vector3.up;
                GameManager.Instance.Drops.Spawn(recipe.ResultItemId, remainder, position);
            }

            GameEvents.RaiseCenter("Craft complete: " + recipe.DisplayName);
            GameManager.Instance.Audio.Play(AudioCue.CraftComplete, UnityEngine.Random.Range(0.95f, 1.08f));
        }
    }
}
