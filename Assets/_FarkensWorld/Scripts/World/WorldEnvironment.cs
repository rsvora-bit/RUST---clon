using System;
using UnityEngine;

namespace FarkensWorld
{
    public enum WeatherType
    {
        Clear,
        Rain,
        Storm,
        Fog
    }

    [Serializable]
    public sealed class EnvironmentSaveData
    {
        public float timeOfDay = 8.25f;
        public WeatherType weather = WeatherType.Clear;
        public float weatherTimer = 150f;
    }

    public sealed class WorldEnvironment : MonoBehaviour
    {
        [SerializeField] private float timeOfDay = 8.25f;
        [SerializeField] private float minutesPerRealSecond = 2.4f;
        [SerializeField] private WeatherType weather = WeatherType.Clear;
        [SerializeField] private float weatherTimer = 150f;

        private Light sun;
        private ParticleSystem rain;
        private Material rainMaterial;

        public float TimeOfDay => timeOfDay;
        public WeatherType Weather => weather;
        public string WeatherName => weather == WeatherType.Clear ? "CLEAR SKY" : weather.ToString().ToUpperInvariant();
        public string FormattedTime => Mathf.FloorToInt(timeOfDay).ToString("00") + ":" + Mathf.FloorToInt((timeOfDay % 1f) * 60f).ToString("00");
        public float Daylight01 => Mathf.Clamp01(Mathf.Sin((timeOfDay - 6f) / 24f * Mathf.PI * 2f) * 0.72f + 0.38f);
        public float RainIntensity => weather == WeatherType.Storm ? 1f : weather == WeatherType.Rain ? 0.58f : 0f;
        public float TemperatureOffset => Mathf.Lerp(-7f, 5f, Daylight01) - RainIntensity * 4f;

        private void Update()
        {
            timeOfDay = Mathf.Repeat(timeOfDay + minutesPerRealSecond * Time.deltaTime / 60f, 24f);
            weatherTimer -= Time.deltaTime;
            if (weatherTimer <= 0f)
            {
                PickNextWeather();
            }

            UpdateLighting();
            UpdateRain();
        }

        public void RefreshWorldReferences()
        {
            sun = RenderSettings.sun;
            EnsureRain();
            UpdateLighting();
            UpdateRain();
        }

        public void ResetForNewWorld(int seed)
        {
            System.Random random = new System.Random(seed + 317);
            timeOfDay = 7.5f + (float)random.NextDouble() * 2.5f;
            weather = WeatherType.Clear;
            weatherTimer = 105f + (float)random.NextDouble() * 100f;
            RefreshWorldReferences();
        }

        public void SetWeather(WeatherType value, float duration = 180f)
        {
            weather = value;
            weatherTimer = Mathf.Max(15f, duration);
            UpdateLighting();
            UpdateRain();
            GameEvents.RaiseCenter("Weather: " + WeatherName);
        }

        public void SetTime(float hour)
        {
            timeOfDay = Mathf.Repeat(hour, 24f);
            UpdateLighting();
            GameEvents.RaiseCenter("Time: " + FormattedTime);
        }

        public EnvironmentSaveData CreateSnapshot()
        {
            return new EnvironmentSaveData { timeOfDay = timeOfDay, weather = weather, weatherTimer = weatherTimer };
        }

        public void Restore(EnvironmentSaveData data)
        {
            if (data == null)
            {
                RefreshWorldReferences();
                return;
            }

            timeOfDay = Mathf.Repeat(data.timeOfDay, 24f);
            weather = data.weather;
            weatherTimer = Mathf.Max(15f, data.weatherTimer);
            RefreshWorldReferences();
        }

        private void PickNextWeather()
        {
            float roll = UnityEngine.Random.value;
            if (roll < 0.5f) weather = WeatherType.Clear;
            else if (roll < 0.75f) weather = WeatherType.Rain;
            else if (roll < 0.9f) weather = WeatherType.Fog;
            else weather = WeatherType.Storm;
            weatherTimer = UnityEngine.Random.Range(95f, 210f);
            GameEvents.RaiseFeed("Weather changed: " + WeatherName);
        }

        private void UpdateLighting()
        {
            if (sun == null)
            {
                sun = RenderSettings.sun;
            }

            float solarAngle = timeOfDay / 24f * 360f - 90f;
            if (sun != null)
            {
                sun.transform.rotation = Quaternion.Euler(solarAngle, -35f, 0f);
                sun.intensity = Mathf.Lerp(0.04f, weather == WeatherType.Storm ? 0.72f : 1.35f, Daylight01);
                sun.color = Color.Lerp(new Color(0.36f, 0.43f, 0.62f), new Color(1f, 0.86f, 0.68f), Daylight01);
            }

            Color dayFog = weather == WeatherType.Storm
                ? new Color(0.24f, 0.3f, 0.34f)
                : weather == WeatherType.Fog ? new Color(0.5f, 0.56f, 0.57f) : new Color(0.52f, 0.68f, 0.76f);
            Color nightFog = new Color(0.035f, 0.055f, 0.09f);
            RenderSettings.fog = true;
            RenderSettings.fogColor = Color.Lerp(nightFog, dayFog, Daylight01);
            RenderSettings.fogStartDistance = weather == WeatherType.Fog ? 28f : weather == WeatherType.Storm ? 55f : 105f;
            RenderSettings.fogEndDistance = weather == WeatherType.Fog ? 125f : weather == WeatherType.Storm ? 180f : 270f;
            RenderSettings.ambientLight = Color.Lerp(new Color(0.035f, 0.05f, 0.09f), new Color(0.45f, 0.5f, 0.53f), Daylight01);
        }

        private void EnsureRain()
        {
            if (rain != null)
            {
                return;
            }

            GameObject rainObject = new GameObject("Procedural Rain");
            rainObject.transform.SetParent(transform, false);
            rain = rainObject.AddComponent<ParticleSystem>();
            ParticleSystem.MainModule main = rain.main;
            main.loop = true;
            main.startLifetime = 1.4f;
            main.startSpeed = 26f;
            main.startSize = 0.045f;
            main.maxParticles = 1800;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = 0.2f;
            ParticleSystem.ShapeModule shape = rain.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(34f, 1f, 34f);
            ParticleSystem.VelocityOverLifetimeModule velocity = rain.velocityOverLifetime;
            velocity.enabled = true;
            velocity.space = ParticleSystemSimulationSpace.World;
            velocity.y = -22f;
            ParticleSystemRenderer renderer = rain.GetComponent<ParticleSystemRenderer>();
            if (rainMaterial == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
                if (shader == null) shader = Shader.Find("Particles/Standard Unlit");
                if (shader == null) shader = Shader.Find("Hidden/InternalErrorShader");
                rainMaterial = new Material(shader) { color = new Color(0.58f, 0.78f, 0.92f, 0.68f) };
            }
            renderer.sharedMaterial = rainMaterial;
        }

        private void UpdateRain()
        {
            EnsureRain();
            GameManager game = GameManager.Instance;
            if (game != null && game.PlayerController != null)
            {
                rain.transform.position = game.PlayerController.transform.position + Vector3.up * 18f;
            }

            ParticleSystem.EmissionModule emission = rain.emission;
            emission.rateOverTime = RainIntensity * 850f;
            if (RainIntensity > 0f && !rain.isPlaying) rain.Play();
            if (RainIntensity <= 0f && rain.isPlaying) rain.Stop(true, ParticleSystemStopBehavior.StopEmitting);
        }
    }
}
