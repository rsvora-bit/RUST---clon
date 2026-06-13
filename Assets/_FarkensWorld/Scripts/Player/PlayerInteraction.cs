using UnityEngine;
using UnityEngine.InputSystem;

namespace FarkensWorld
{
    public sealed class PlayerInteraction : MonoBehaviour
    {
        [SerializeField] private float interactDistance = 4.5f;
        [SerializeField] private float scanInterval = 0.075f;

        private FirstPersonController controller;
        private float nextScan;
        private IInteractable currentTarget;

        public string CurrentPrompt => currentTarget == null ? string.Empty : currentTarget.InteractionPrompt;

        private void Awake()
        {
            controller = GetComponent<FirstPersonController>();
        }

        private void Update()
        {
            if (GameManager.Instance == null || GameManager.Instance.GameplayInputBlocked)
            {
                currentTarget = null;
                return;
            }

            if (Time.time >= nextScan)
            {
                nextScan = Time.time + scanInterval;
                Scan();
            }

            if (Keyboard.current != null && Keyboard.current.eKey.wasPressedThisFrame && currentTarget != null)
            {
                currentTarget.Interact(this);
                Scan();
            }
        }

        public PlayerStats GetPlayerStats()
        {
            return GetComponent<PlayerStats>();
        }

        private void Scan()
        {
            currentTarget = null;
            Camera camera = controller.PlayerCamera;
            RaycastHit hit;
            if (!Physics.Raycast(camera.transform.position, camera.transform.forward, out hit, interactDistance))
            {
                return;
            }

            MonoBehaviour[] behaviours = hit.collider.GetComponentsInParent<MonoBehaviour>();
            for (int i = 0; i < behaviours.Length; i++)
            {
                IInteractable interactable = behaviours[i] as IInteractable;
                if (interactable != null)
                {
                    currentTarget = interactable;
                    return;
                }
            }
        }
    }
}
