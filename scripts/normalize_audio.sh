#!/bin/bash
# Normalise all audio to consistent LUFS with format-appropriate encoding
#
# Music:  -14 LUFS, stereo, 44.1kHz, 192kbps AAC (featured audio)
# Speech: -14 LUFS, mono, 24kHz, 104kbps AAC (voice clarity)
# SFX:    -15 LUFS, mono, 24kHz, 64kbps AAC (short accents)

BASE="public/guruswami"
TMPDIR="/tmp/audio_normalize_$$"
mkdir -p "$TMPDIR"

normalize() {
  local f="$1" target="$2" channels="$3" rate="$4" bitrate="$5"
  local tmp="$TMPDIR/$(basename "$f")"
  ffmpeg -i "$f" -af "loudnorm=I=${target}:TP=-1.5:LRA=11" \
    -c:a aac -b:a "${bitrate}" -ar "${rate}" -ac "${channels}" -y "$tmp" 2>/dev/null
  if [ -s "$tmp" ]; then
    mv "$tmp" "$f"
  else
    rm -f "$tmp"
  fi
}

total_music=$(find "$BASE/music" -name "*.m4a" -not -path "*/archive*" | wc -l | tr -d ' ')
total_voice=$(find "$BASE/voice" -name "*.m4a" | wc -l | tr -d ' ')
total_sfx=$(find "$BASE/sfx" -name "*.m4a" | wc -l | tr -d ' ')
echo "Files: ${total_music} music, ${total_voice} voice, ${total_sfx} SFX"
echo ""

echo "=== Music → -14 LUFS (stereo, 44.1kHz, 192k) ==="
i=0
find "$BASE/music" -name "*.m4a" -not -path "*/archive*" | sort | while read f; do
  i=$((i + 1))
  printf "  [%d/%s] %s\n" "$i" "$total_music" "$(basename "$f")"
  normalize "$f" "-14" "2" "44100" "192k"
done

echo ""
echo "=== Speech → -14 LUFS (mono, 24kHz, 104k) ==="
i=0
find "$BASE/voice" -name "*.m4a" | sort | while read f; do
  i=$((i + 1))
  printf "\r  [%d/%s]" "$i" "$total_voice"
  normalize "$f" "-14" "1" "24000" "104k"
done
echo ""

echo ""
echo "=== SFX → -15 LUFS (mono, 24kHz, 64k) ==="
i=0
find "$BASE/sfx" -name "*.m4a" | sort | while read f; do
  i=$((i + 1))
  printf "  [%d/%s] %s\n" "$i" "$total_sfx" "$(basename "$f")"
  normalize "$f" "-15" "1" "24000" "64k"
done

rm -rf "$TMPDIR"

echo ""
echo "=== Verification ==="
for f in "$BASE/music/deep-pads.m4a" "$BASE/music/balanced.m4a" \
         "$BASE/voice/onboarding/gs_onboard_greeting_001.m4a" \
         "$BASE/voice/error_hint/gs_error_hint_001.m4a" \
         "$BASE/sfx/select_1.m4a" "$BASE/sfx/guru_clicked00001.m4a" \
         "$BASE/sfx/guru_appear_00001.m4a" "$BASE/sfx/audio_stop00001.m4a"; do
  [ -f "$f" ] || continue
  lufs=$(ffmpeg -i "$f" -af loudnorm=print_format=json -f null - 2>&1 | grep input_i | head -1 | grep -o '[-0-9.]*')
  br=$(ffprobe -v quiet -show_entries stream=bit_rate -of csv=p=0 "$f" 2>/dev/null)
  ch=$(ffprobe -v quiet -show_entries stream=channels -of csv=p=0 "$f" 2>/dev/null)
  echo "  $(basename "$f"): ${lufs} LUFS, ${ch}ch, $((br/1000))kbps"
done
echo ""
echo "Done."
