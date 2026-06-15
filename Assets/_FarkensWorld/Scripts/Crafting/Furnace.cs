using UnityEngine;

namespace FarkensWorld
{
    public sealed class Furnace : ContainerInventory
    {
        [SerializeField] private bool active;
        [SerializeField] private float progress;
        [SerializeField] private float smeltTime = 5f;

        public bool IsActive => active;
        public float Progress01 => progress / smeltTime;
        public override string InteractionPrompt => "E - open furnace";

        protected override void Awake()
        {
            base.Awake();
            Configure("Furnace", 6);
        }

        private void Update()
        {
            if (!active)
            {
                return;
            }

            string inputId;
            string outputId;
            int outputAmount;
            int inputSlot;
            if (!TryGetRecipe(out inputId, out outputId, out outputAmount, out inputSlot) || !HasFuel() || !CanFitOutput(outputId, outputAmount))
            {
                return;
            }

            progress += Time.deltaTime;
            if (progress < smeltTime)
            {
                return;
            }

            progress = 0f;
            inventory.RemoveFromSlot(inputSlot, 1);
            inventory.RemoveFromSlot(2, 1);
            AddOutput(outputId, outputAmount);
            GameEvents.RaiseFeed("Furnace produced " + outputId + " x" + outputAmount);
        }

        public void ToggleActive()
        {
            active = !active;
            GameEvents.RaiseCenter(active ? "Furnace started" : "Furnace stopped");
            GameManager.Instance.Audio.Play(active ? AudioCue.CraftStart : AudioCue.Hit, active ? 0.72f : 0.8f);
        }

        public override int Deposit(string itemId, int amount, int durability = 0)
        {
            if (itemId == "lowGradeFuel")
            {
                return inventory.AddToSlot(2, itemId, amount, durability);
            }

            if (itemId == "metalOre" || itemId == "sulfurOre" || itemId == "crudeOil")
            {
                int remainder = inventory.AddToSlot(0, itemId, amount, durability);
                return remainder > 0 ? inventory.AddToSlot(1, itemId, remainder, durability) : 0;
            }

            return amount;
        }

        public void RestoreState(bool isActive, float savedProgress)
        {
            active = isActive;
            progress = Mathf.Clamp(savedProgress, 0f, smeltTime);
        }

        private bool TryGetRecipe(out string inputId, out string outputId, out int outputAmount, out int inputSlot)
        {
            for (int i = 0; i < 2; i++)
            {
                InventorySlot slot = inventory.GetSlot(i);
                if (slot == null || slot.IsEmpty)
                {
                    continue;
                }

                inputId = slot.itemId;
                inputSlot = i;
                if (inputId == "metalOre")
                {
                    outputId = "metalFragments";
                    outputAmount = 3;
                    return true;
                }

                if (inputId == "sulfurOre")
                {
                    outputId = "sulfur";
                    outputAmount = 2;
                    return true;
                }

                if (inputId == "crudeOil")
                {
                    outputId = "lowGradeFuel";
                    outputAmount = 3;
                    return true;
                }
            }

            inputId = string.Empty;
            outputId = string.Empty;
            outputAmount = 0;
            inputSlot = -1;
            return false;
        }

        private bool HasFuel()
        {
            InventorySlot fuel = inventory.GetSlot(2);
            return fuel != null && fuel.itemId == "lowGradeFuel" && fuel.amount > 0;
        }

        private bool CanFitOutput(string itemId, int amount)
        {
            ItemDefinition definition = ItemDatabase.Get(itemId);
            int room = 0;
            for (int i = 3; i < 6; i++)
            {
                InventorySlot slot = inventory.GetSlot(i);
                if (slot.IsEmpty)
                {
                    room += definition.StackLimit;
                }
                else if (slot.itemId == itemId)
                {
                    room += definition.StackLimit - slot.amount;
                }
            }

            return room >= amount;
        }

        private void AddOutput(string itemId, int amount)
        {
            int remainder = amount;
            for (int i = 3; i < 6 && remainder > 0; i++)
            {
                remainder = inventory.AddToSlot(i, itemId, remainder);
            }
        }
    }
}
