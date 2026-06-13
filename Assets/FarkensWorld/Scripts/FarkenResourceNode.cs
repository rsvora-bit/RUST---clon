using UnityEngine;

namespace FarkensWorld
{
    public enum ResourceKind
    {
        Tree,
        Rock
    }

    public sealed class FarkenResourceNode : MonoBehaviour
    {
        [SerializeField] private ResourceKind kind;
        [SerializeField] private int remainingHits = 4;
        [SerializeField] private int yieldPerHit = 12;

        public string Prompt => kind == ResourceKind.Tree
            ? $"E - gather wood ({remainingHits} hits left)"
            : $"E - gather stone ({remainingHits} hits left)";

        public void Configure(ResourceKind resourceKind, int hits, int amountPerHit)
        {
            kind = resourceKind;
            remainingHits = hits;
            yieldPerHit = amountPerHit;
        }

        public void Harvest(FarkenPlayerController player)
        {
            if (remainingHits <= 0)
            {
                return;
            }

            if (kind == ResourceKind.Tree)
            {
                player.AddWood(yieldPerHit);
                player.ShowMessage($"+{yieldPerHit} wood");
            }
            else
            {
                player.AddStone(yieldPerHit);
                player.ShowMessage($"+{yieldPerHit} stone");
            }

            remainingHits--;
            transform.localScale *= 0.94f;

            if (remainingHits <= 0)
            {
                player.ShowMessage(kind == ResourceKind.Tree ? "Tree depleted" : "Rock depleted");
                Destroy(gameObject);
            }
        }
    }
}
