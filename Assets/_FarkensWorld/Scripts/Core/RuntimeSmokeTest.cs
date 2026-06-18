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

            Exception failure = null;
            IEnumerator smoke = RunSmoke();
            while (failure == null)
            {
                object current = null;
                bool keepGoing = false;
                try
                {
                    keepGoing = smoke.MoveNext();
                    if (keepGoing)
                    {
                        current = smoke.Current;
                    }
                }
                catch (Exception exception)
                {
                    failure = exception;
                }

                if (!keepGoing || failure != null)
                {
                    break;
                }

                yield return current;
            }

            if (failure != null)
            {
                Debug.LogError("[FARKENS_SMOKE] FAIL | " + failure);
                Application.Quit(1);
            }
        }

        private IEnumerator RunSmoke()
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
            Require(game.World.GrassDetailCount >= 400, "Static grass detail mesh missing");
            VerifyColliderPatch();
            yield return VerifyMovementPath(game);

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
                " | ground=" + GroundName(game.PlayerController) +
                " | grassDetails=" + game.World.GrassDetailCount +
                " | actors=" + game.Population.ActiveCount +
                " | weather=" + game.Environment.WeatherName +
                " | time=" + game.Environment.FormattedTime);
            Application.Quit(0);
        }

        private static void Require(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }

        private static void VerifyColliderPatch()
        {
            Require(GameObject.Find("Beach Visual").GetComponent<Collider>() == null, "Beach Visual still has a walkable collider");
            Require(GameObject.Find("Island Visual").GetComponent<Collider>() == null, "Island Visual still has a walkable collider");
            Require(GameObject.Find("Road").GetComponent<Collider>() == null, "Road visual still has a raised collider lip");
            Require(GameObject.Find("Walkable Island Collider").GetComponent<BoxCollider>() != null, "Walkable Island Collider is not a BoxCollider");
            Require(GameObject.Find("Walkable Beach Collider").GetComponent<BoxCollider>() != null, "Walkable Beach Collider is not a BoxCollider");
            Require(GameObject.Find("Fallback Safety Collider").GetComponent<BoxCollider>() != null, "Fallback Safety Collider is not a BoxCollider");
        }

        private static IEnumerator VerifyMovementPath(GameManager game)
        {
            FirstPersonController controller = game.PlayerController;
            CharacterController character = controller.GetComponent<CharacterController>();
            controller.Teleport(game.World.PlayerSpawn);
            yield return null;
            RequireGround(controller, "spawn");

            yield return WalkTo(controller, character, new Vector3(-6f, 0f, 4f), "beach to grass");
            yield return WalkTo(controller, character, new Vector3(0f, 0f, 4f), "road crossing");
            yield return WalkTo(controller, character, new Vector3(0f, 0f, 0f), "island center");
            Require(Vector3.Distance(new Vector3(controller.transform.position.x, 0f, controller.transform.position.z), Vector3.zero) < 1.3f,
                "Player could not reach island center");
        }

        private static IEnumerator WalkTo(FirstPersonController controller, CharacterController character, Vector3 target, string label)
        {
            float elapsed = 0f;
            while (elapsed < 8f)
            {
                Vector3 current = controller.transform.position;
                Vector3 flatTarget = new Vector3(target.x, current.y, target.z);
                Vector3 direction = flatTarget - current;
                direction.y = 0f;
                if (direction.magnitude < 0.65f)
                {
                    break;
                }

                direction.Normalize();
                float deltaTime = Mathf.Max(Time.deltaTime, 0.016f);
                character.Move((direction * 5.8f + Vector3.down * 5f) * deltaTime);
                Require(controller.transform.position.y > -5f, "Player fell below the map during " + label);
                elapsed += deltaTime;
                yield return null;
            }

            RequireGround(controller, label);
            Vector3 finalPosition = controller.transform.position;
            float distance = Vector2.Distance(new Vector2(finalPosition.x, finalPosition.z), new Vector2(target.x, target.z));
            Require(distance < 1.25f, "Player got stuck before " + label + " (" + distance.ToString("0.00") + "m away)");
        }

        private static void RequireGround(FirstPersonController controller, string label)
        {
            Require(controller.TryGetGroundHit(out RaycastHit hit), "No ground under player at " + label);
            Require(hit.collider is BoxCollider, "Ground at " + label + " is not a BoxCollider: " + GroundName(controller));
            Require(controller.transform.position.y < 1.5f, "Player is too high above ground at " + label);
        }

        private static string GroundName(FirstPersonController controller)
        {
            if (controller != null && controller.TryGetGroundHit(out RaycastHit hit) && hit.collider != null)
            {
                return hit.collider.name + " (" + hit.collider.GetType().Name + ")";
            }

            return "none";
        }
    }
}
