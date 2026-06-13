using UnityEngine;

namespace FarkensWorld
{
    public sealed class WaterZone : MonoBehaviour, IInteractable
    {
        public string InteractionPrompt => "E - drink fresh water";

        public void Interact(PlayerInteraction player)
        {
            player.GetPlayerStats().Drink(28f);
            GameEvents.RaiseCenter("You drink fresh water");
        }
    }
}
