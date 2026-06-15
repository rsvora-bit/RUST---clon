using System.Collections.Generic;
using UnityEngine;

namespace FarkensWorld
{
    public enum AudioCue
    {
        Pickup,
        Hit,
        Break,
        BowShoot,
        ArrowHit,
        PlayerHurt,
        Death,
        CraftStart,
        CraftComplete,
        Build,
        Error
    }

    public sealed class ProceduralAudio : MonoBehaviour
    {
        private const int SampleRate = 22050;
        private readonly Dictionary<AudioCue, AudioClip> clips = new Dictionary<AudioCue, AudioClip>();
        private AudioSource oneShotSource;
        private AudioSource rainSource;

        private void Awake()
        {
            oneShotSource = gameObject.AddComponent<AudioSource>();
            oneShotSource.playOnAwake = false;
            oneShotSource.spatialBlend = 0f;
            rainSource = gameObject.AddComponent<AudioSource>();
            rainSource.playOnAwake = false;
            rainSource.loop = true;
            rainSource.spatialBlend = 0f;
            rainSource.clip = CreateNoiseClip("Rain ambience", 2f, 0.14f);
            CreateClips();
        }

        private void Update()
        {
            GameManager game = GameManager.Instance;
            if (game == null || game.Settings == null) return;
            GameSettingsData settings = game.Settings.Values;
            oneShotSource.volume = settings.muteAll ? 0f : settings.sfxVolume;
            float rain = game.Environment == null ? 0f : game.Environment.RainIntensity;
            rainSource.volume = settings.muteAll ? 0f : settings.ambienceVolume * rain * 0.42f;
            if (rain > 0f && !rainSource.isPlaying) rainSource.Play();
            if (rain <= 0f && rainSource.isPlaying) rainSource.Stop();
        }

        public void Play(AudioCue cue, float pitch = 1f)
        {
            if (!clips.TryGetValue(cue, out AudioClip clip) || oneShotSource == null) return;
            oneShotSource.pitch = Mathf.Clamp(pitch, 0.65f, 1.5f);
            oneShotSource.PlayOneShot(clip);
        }

        private void CreateClips()
        {
            clips[AudioCue.Pickup] = CreateToneClip("Pickup", 760f, 0.09f, 0.16f);
            clips[AudioCue.Hit] = CreateNoiseClip("Hit", 0.08f, 0.38f);
            clips[AudioCue.Break] = CreateNoiseClip("Break", 0.2f, 0.46f);
            clips[AudioCue.BowShoot] = CreateToneClip("Bow shoot", 170f, 0.16f, 0.24f);
            clips[AudioCue.ArrowHit] = CreateToneClip("Arrow hit", 260f, 0.09f, 0.24f);
            clips[AudioCue.PlayerHurt] = CreateToneClip("Player hurt", 92f, 0.18f, 0.3f);
            clips[AudioCue.Death] = CreateToneClip("Death", 58f, 0.65f, 0.35f);
            clips[AudioCue.CraftStart] = CreateToneClip("Craft start", 420f, 0.11f, 0.18f);
            clips[AudioCue.CraftComplete] = CreateToneClip("Craft complete", 920f, 0.16f, 0.18f);
            clips[AudioCue.Build] = CreateNoiseClip("Build", 0.13f, 0.3f);
            clips[AudioCue.Error] = CreateToneClip("Error", 105f, 0.2f, 0.22f);
        }

        private static AudioClip CreateToneClip(string clipName, float frequency, float duration, float gain)
        {
            int samples = Mathf.CeilToInt(SampleRate * duration);
            float[] data = new float[samples];
            for (int i = 0; i < samples; i++)
            {
                float t = i / (float)SampleRate;
                float envelope = 1f - i / (float)samples;
                data[i] = Mathf.Sin(t * frequency * Mathf.PI * 2f) * envelope * gain;
            }
            AudioClip clip = AudioClip.Create(clipName, samples, 1, SampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private static AudioClip CreateNoiseClip(string clipName, float duration, float gain)
        {
            int samples = Mathf.CeilToInt(SampleRate * duration);
            float[] data = new float[samples];
            float previous = 0f;
            for (int i = 0; i < samples; i++)
            {
                float noise = Random.Range(-1f, 1f);
                previous = Mathf.Lerp(previous, noise, 0.22f);
                float envelope = duration > 0.5f ? 1f : 1f - i / (float)samples;
                data[i] = previous * envelope * gain;
            }
            AudioClip clip = AudioClip.Create(clipName, samples, 1, SampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
