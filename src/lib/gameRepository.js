import { hasSupabaseConfig, supabase } from "./supabaseClient.js";

function safePayload(value) {
  return JSON.parse(JSON.stringify(value));
}

async function currentUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function recordBattleResult(result) {
  if (!hasSupabaseConfig || !supabase) return { skipped: true };

  const userId = await currentUserId();
  const payload = {
    user_id: userId,
    mode: result.mode,
    category_id: result.category.id,
    category_name: result.category.name,
    prompt: result.prompt,
    opponent_name: result.opponent,
    your_answer: result.yourAnswer,
    opponent_answer: result.opponentAnswer,
    you_win: result.youWin,
    point_delta: result.points,
    ai_reason: result.reason,
    metadata: safePayload(result),
  };

  const { error } = await supabase.from("battle_results").insert(payload);
  if (error) {
    console.warn("Supabase battle result insert failed", error);
    return { error };
  }

  return { ok: true };
}

export async function recordViewerSubmission({ roomCode, displayName, answer }) {
  if (!hasSupabaseConfig || !supabase) return { skipped: true };

  const userId = await currentUserId();
  const { error } = await supabase.from("streamer_viewer_answers").insert({
    room_code: roomCode,
    viewer_user_id: userId,
    display_name: displayName,
    answer,
  });

  if (error) {
    console.warn("Supabase viewer answer insert failed", error);
    return { error };
  }

  return { ok: true };
}
