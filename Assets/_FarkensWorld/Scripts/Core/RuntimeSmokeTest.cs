using System;
using System.Collections;
using UnityEngine;

namespace FarkensWorld
{
    public sealed class RuntimeSmokeTest : MonoBehaviour
    {
        public static bool Requested
        {
            get
            {
                string[] arguments = Environment.GetCommandLineArgs();
                for (int i = 0; i < arguments.Length; i++)
                {
                    if (arguments[i] == "-farkensSmokeTest") return true;
                }
                return false;
            }
        }

        private IEnumerator Start()
        {
            yield return null;
            yield return new WaitForSecondsRealtime(1.5f);

            try
            {
                GameManager game = GameManager.Instance;
                Require(game != null, "GameManager missing");
                Require(game.PlayerController != null, "Player controller missing");
                Require(game.PlayerController.transform.position.y > -5f, "Player spawned below the world");
                Require(game.World != null && game.World.WorldSeed != 0, "World was not generated");
                Require(game.Environment != null, "Environment missing");
                Require(game.Population != null && game.Population.ActiveCount >= 10, "World population missing");
                Require(game.Settings != null && game.SettingsUI != null, "Settings system missing");
                Require(game.DeathUI != null, "Death UI missing");

                game.Environment.SetTime(22f);
                game.Environment.SetWeather(WeatherType.Rain, 30f);
                Require(game.Environment.Weather == WeatherType.Rain, "Weather command did not apply");
                game.PlayerStats.AddBleeding(5f);
                Require(game.PlayerStats.Values.bleeding >= 4.9f, "Bleeding debug path failed");
                game.PlayerStats.Damage(1000f);
                Require(game.IsDead && game.DeathUI.IsOpen, "Death flow failed");
                game.Respawn();
                Require(!game.IsDead && !game.DeathUI.IsOpen && game.PlayerStats.Values.health > 99f, "Respawn flow failed");
                Require(game.PlayerController.transform.position.y < 15f, "Respawn snapped to a non-ground collider");
                WorldActor spawned = game.Population.Spawn(WorldActorKind.Wolf, game.PlayerController.transform.position + Vector3.forward * 9f);
                Require(spawned != null && spawned.IsAlive, "Actor spawn failed");

                Debug.Log("[FARKENS_SMOKE] PASS | " + GameManager.Version +
                    " | seed=" + game.World.WorldSeed +
                    " | player=" + game.PlayerController.transform.position +
                    " | actors=" + game.Population.ActiveCount +
                    " | weather=" + game.Environment.WeatherName +
                    " | time=" + game.Environment.FormattedTime);
                Application.Quit(0);
            }
            catch (Exception exception)
            {
                Debug.LogError("[FARKENS_SMOKE] FAIL | " + exception);
                Application.Quit(1);
            }
        }

        private static void Require(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }
    }
}
