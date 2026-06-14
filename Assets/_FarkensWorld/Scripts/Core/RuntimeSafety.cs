using UnityEngine;

namespace FarkensWorld
{
    public sealed class RuntimeSafety : MonoBehaviour
    {
        private const float RespawnY = -20f;
        private const float CheckInterval = 0.25f;

        private float nextCheckTime;
        private GameObject fallbackGround;

        private void Awake()
        {
            EnsureFallbackGround();
        }

        private void Update()
        {
            if (Time.unscaledTime < nextCheckTime)
            {
                return;
            }

            nextCheckTime = Time.unscaledTime + CheckInterval;

            GameManager game = GameManager.Instance;
            if (game == null || game.PlayerController == null)
            {
                return;
            }

            Vector3 position = game.PlayerController.transform.position;
            if (float.IsNaN(position.x) || float.IsNaN(position.y) || float.IsNaN(position.z) ||
                float.IsInfinity(position.x) || float.IsInfinity(position.y) || float.IsInfinity(position.z))
            {
                game.Respawn();
                return;
            }

            if (position.y < RespawnY)
            {
                game.Respawn();
            }
        }

        private void EnsureFallbackGround()
        {
            if (fallbackGround != null)
            {
                return;
            }

            fallbackGround = GameObject.CreatePrimitive(PrimitiveType.Cube);
            fallbackGround.name = "Runtime Collision Failsafe Floor";
            fallbackGround.transform.SetParent(transform, false);
            fallbackGround.transform.position = new Vector3(0f, -0.08f, 0f);
            fallbackGround.transform.localScale = new Vector3(170f, 0.16f, 170f);

            Renderer renderer = fallbackGround.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.enabled = false;
            }
        }
    }
}
