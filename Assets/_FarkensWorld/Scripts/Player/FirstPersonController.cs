using UnityEngine;
using UnityEngine.InputSystem;

namespace FarkensWorld
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class FirstPersonController : MonoBehaviour
    {
        [SerializeField] private float walkSpeed = 5.5f;
        [SerializeField] private float sprintSpeed = 8.5f;
        [SerializeField] private float jumpHeight = 1.25f;
        [SerializeField] private float mouseSensitivity = 0.12f;

        private const float Gravity = -24f;
        private const float GroundProbeHeight = 80f;
        private const float GroundProbeDistance = 180f;
        private const float GroundClearance = 0.08f;

        private CharacterController characterController;
        private PlayerStats stats;
        private Camera playerCamera;
        private float verticalVelocity;
        private float pitch;

        public Camera PlayerCamera => playerCamera;
        public float Yaw => transform.eulerAngles.y;
        public bool FlyMode { get; set; }
        public bool IsCharacterGrounded => characterController != null && characterController.isGrounded;
        public float MouseSensitivity
        {
            get => mouseSensitivity;
            set => mouseSensitivity = Mathf.Clamp(value, 0.04f, 0.35f);
        }

        private void Awake()
        {
            characterController = GetComponent<CharacterController>();
            stats = GetComponent<PlayerStats>();
            CreateCamera();
        }

        private void Update()
        {
            if (transform.position.y < -20f && GameManager.Instance != null)
            {
                GameManager.Instance.Respawn();
                return;
            }

            if (GameManager.Instance == null || GameManager.Instance.GameplayInputBlocked)
            {
                stats.IsSprinting = false;
                return;
            }

            if (Application.isBatchMode)
            {
                stats.IsSprinting = false;
                return;
            }

            Keyboard keyboard = Keyboard.current;
            Mouse mouse = Mouse.current;
            if (keyboard == null)
            {
                return;
            }

            if (mouse != null)
            {
                Vector2 mouseDelta = mouse.delta.ReadValue();
                transform.Rotate(Vector3.up, mouseDelta.x * mouseSensitivity, Space.Self);
                pitch = Mathf.Clamp(pitch - mouseDelta.y * mouseSensitivity, -85f, 85f);
                playerCamera.transform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
            }

            UpdateMovement(keyboard);
            UpdateHotbar(keyboard);
        }

        public bool TryGetGroundHit(out RaycastHit groundHit)
        {
            Vector3 rayOrigin = transform.position + Vector3.up * 3f;
            RaycastHit[] hits = Physics.RaycastAll(rayOrigin, Vector3.down, 8f, ~0, QueryTriggerInteraction.Ignore);
            float highestGround = float.NegativeInfinity;
            int bestIndex = -1;
            for (int i = 0; i < hits.Length; i++)
            {
                RaycastHit hit = hits[i];
                if (!IsValidGroundHit(hit.collider) || hit.point.y > transform.position.y + 0.75f)
                {
                    continue;
                }

                if (hit.point.y > highestGround)
                {
                    highestGround = hit.point.y;
                    bestIndex = i;
                }
            }

            if (bestIndex >= 0)
            {
                groundHit = hits[bestIndex];
                return true;
            }

            groundHit = default;
            return false;
        }

        public void Teleport(Vector3 position, float yaw = 0f, bool snapToGround = true)
        {
            bool enabledBefore = characterController != null && characterController.enabled;
            if (characterController != null)
            {
                characterController.enabled = false;
                Physics.SyncTransforms();
            }

            Vector3 safePosition = snapToGround ? SnapToGround(position) : position;
            transform.position = safePosition;
            transform.rotation = Quaternion.Euler(0f, yaw, 0f);
            verticalVelocity = 0f;

            if (characterController != null)
            {
                characterController.enabled = enabledBefore;
                Physics.SyncTransforms();
            }
        }

        private static Vector3 SnapToGround(Vector3 desiredPosition)
        {
            Vector3 rayOrigin = new Vector3(desiredPosition.x, desiredPosition.y + GroundProbeHeight, desiredPosition.z);
            RaycastHit[] hits = Physics.RaycastAll(rayOrigin, Vector3.down, GroundProbeDistance, ~0, QueryTriggerInteraction.Ignore);
            float highestGround = float.NegativeInfinity;
            float maximumAllowedY = desiredPosition.y + 12f;
            for (int i = 0; i < hits.Length; i++)
            {
                RaycastHit hit = hits[i];
                if (hit.point.y > maximumAllowedY || !IsValidGroundHit(hit.collider))
                {
                    continue;
                }

                highestGround = Mathf.Max(highestGround, hit.point.y);
            }

            if (!float.IsNegativeInfinity(highestGround))
            {
                return new Vector3(desiredPosition.x, highestGround + GroundClearance, desiredPosition.z);
            }

            return desiredPosition;
        }

        private static bool IsValidGroundHit(Collider collider)
        {
            if (collider == null || collider is CharacterController)
            {
                return false;
            }

            Transform target = collider.transform;
            return target.GetComponentInParent<ResourceNode>() == null &&
                target.GetComponentInParent<LootContainer>() == null &&
                target.GetComponentInParent<DroppedItem>() == null &&
                target.GetComponentInParent<ContainerInventory>() == null &&
                target.GetComponentInParent<WorldActor>() == null;
        }

        private void UpdateMovement(Keyboard keyboard)
        {
            float deltaTime = Mathf.Min(Time.deltaTime, 0.05f);
            Vector2 input = new Vector2(
                (keyboard.dKey.isPressed ? 1f : 0f) - (keyboard.aKey.isPressed ? 1f : 0f),
                (keyboard.wKey.isPressed ? 1f : 0f) - (keyboard.sKey.isPressed ? 1f : 0f));
            input = Vector2.ClampMagnitude(input, 1f);

            bool wantsSprint = keyboard.leftShiftKey.isPressed && input.y > 0f && stats.CanSprint;
            stats.IsSprinting = wantsSprint;
            float speed = wantsSprint ? sprintSpeed : walkSpeed;
            Vector3 horizontal = (transform.right * input.x + transform.forward * input.y) * speed;

            if (FlyMode)
            {
                float vertical = (keyboard.spaceKey.isPressed ? 1f : 0f) - (keyboard.leftCtrlKey.isPressed ? 1f : 0f);
                verticalVelocity = 0f;
                characterController.Move((horizontal + Vector3.up * vertical * speed) * deltaTime);
                return;
            }

            if (characterController.isGrounded && verticalVelocity < 0f)
            {
                verticalVelocity = -2f;
            }

            if (characterController.isGrounded && keyboard.spaceKey.wasPressedThisFrame)
            {
                verticalVelocity = Mathf.Sqrt(jumpHeight * -2f * Gravity);
            }

            verticalVelocity += Gravity * deltaTime;
            characterController.Move((horizontal + Vector3.up * verticalVelocity) * deltaTime);
        }

        private static void UpdateHotbar(Keyboard keyboard)
        {
            Key[] keys = { Key.Digit1, Key.Digit2, Key.Digit3, Key.Digit4, Key.Digit5, Key.Digit6 };
            for (int i = 0; i < keys.Length; i++)
            {
                if (keyboard[keys[i]].wasPressedThisFrame)
                {
                    GameManager.Instance.Hotbar.Select(i);
                }
            }
        }

        private void CreateCamera()
        {
            foreach (Camera existingCamera in FindObjectsByType<Camera>())
            {
                existingCamera.gameObject.SetActive(false);
            }

            GameObject cameraObject = new GameObject("Player Camera");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.SetParent(transform, false);
            cameraObject.transform.localPosition = new Vector3(0f, 1.62f, 0f);
            playerCamera = cameraObject.AddComponent<Camera>();
            playerCamera.fieldOfView = 72f;
            playerCamera.nearClipPlane = 0.05f;
            playerCamera.farClipPlane = 600f;
            cameraObject.AddComponent<AudioListener>();

            if (GameManager.Instance != null && GameManager.Instance.Settings != null)
            {
                mouseSensitivity = GameManager.Instance.Settings.Values.mouseSensitivity;
                playerCamera.fieldOfView = GameManager.Instance.Settings.Values.fieldOfView;
            }
        }
    }
}
