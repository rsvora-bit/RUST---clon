using System;
using UnityEngine;

namespace FarkensWorld
{
    [Serializable]
    public sealed class PlayerStatsData
    {
        public float health = 100f;
        public float hunger = 100f;
        public float thirst = 100f;
        public float stamina = 100f;
        public float wetness;
        public float radiation;
        public float bleeding;
        public float temperature = 17f;
    }

    public sealed class PlayerStats : MonoBehaviour
    {
        [SerializeField] private PlayerStatsData values = new PlayerStatsData();

        public PlayerStatsData Values => values;
        public bool IsSprinting { get; set; }
        public bool GodMode { get; set; }
        public bool CanSprint => values.stamina > 1f && values.health > 0f;

        private void Update()
        {
            if (GodMode)
            {
                values.health = 100f;
                values.hunger = 100f;
                values.thirst = 100f;
                values.stamina = 100f;
                values.bleeding = 0f;
                values.radiation = 0f;
                values.temperature = 17f;
                return;
            }

            values.hunger = Mathf.Max(0f, values.hunger - 0.23f * Time.deltaTime);
            values.thirst = Mathf.Max(0f, values.thirst - 0.38f * Time.deltaTime);

            float staminaDelta = IsSprinting ? -18f : 12f;
            values.stamina = Mathf.Clamp(values.stamina + staminaDelta * Time.deltaTime, 0f, 100f);
            values.wetness = Mathf.Max(0f, values.wetness - 1.8f * Time.deltaTime);
            values.bleeding = Mathf.Max(0f, values.bleeding - 0.08f * Time.deltaTime);
            values.temperature = 16f + Mathf.Sin(Time.time * 0.02f) * 6f - values.wetness * 0.12f;

            float damage = 0f;
            if (values.hunger <= 0f || values.thirst <= 0f)
            {
                damage += 2.5f;
            }

            damage += values.bleeding * 0.08f;
            damage += values.radiation > 70f ? (values.radiation - 70f) * 0.03f : 0f;
            damage += values.temperature < 1f ? 0.62f : 0f;
            values.health = Mathf.Max(0f, values.health - damage * Time.deltaTime);
        }

        public void ResetStats()
        {
            values = new PlayerStatsData();
        }

        public void Restore(PlayerStatsData data)
        {
            values = data ?? new PlayerStatsData();
        }

        public void Respawn()
        {
            values.health = 100f;
            values.hunger = 72f;
            values.thirst = 72f;
            values.stamina = 100f;
            values.wetness = 0f;
            values.radiation = 0f;
            values.bleeding = 0f;
            values.temperature = 17f;
        }

        public void Drink(float amount)
        {
            values.thirst = Mathf.Min(100f, values.thirst + amount);
        }

        public void Feed(float amount)
        {
            values.hunger = Mathf.Min(100f, values.hunger + amount);
        }

        public void Heal(float amount)
        {
            values.health = Mathf.Min(100f, values.health + amount);
        }

        public void ReduceBleeding(float amount)
        {
            values.bleeding = Mathf.Max(0f, values.bleeding - amount);
        }
    }
}
