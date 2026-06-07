import { hasSupabaseConfig, supabase } from "./supabaseClient.js";

const PRESENCE_STORAGE_KEY = "judgemebro:presence-id";

function safePayload(value) {
  return JSON.parse(JSON.stringify(value));
}

function randomId(prefix) {
  const cryptoValue = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${cryptoValue}`.slice(0, 80);
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function presenceId() {
  if (typeof window === "undefined") return randomId("server");

  const existing = window.localStorage.getItem(PRESENCE_STORAGE_KEY);
  if (existing) return existing;

  const next = randomId("player");
  window.localStorage.setItem(PRESENCE_STORAGE_KEY, next);
  return next;
}

export function getPlayerPresenceId() {
  return presenceId();
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

export async function createStreamerRoom({
  roomCode,
  roomName = "Kai's room",
  categoryId = "dating",
  currentPrompt = "",
}) {
  if (!hasSupabaseConfig || !supabase) return { skipped: true };

  const hostPresenceId = presenceId();
  const { data, error } = await supabase
    .from("streamer_rooms")
    .upsert(
      {
        room_code: roomCode,
        room_name: roomName,
        host_presence_id: hostPresenceId,
        category_id: categoryId,
        current_prompt: currentPrompt,
        is_live: true,
      },
      { onConflict: "room_code" },
    )
    .select()
    .single();

  if (error) {
    console.warn("Supabase streamer room upsert failed", error);
    return { error };
  }

  return { room: data, hostPresenceId };
}

export async function getStreamerRoom(roomCode) {
  if (!hasSupabaseConfig || !supabase || !roomCode) return { skipped: true };

  const { data, error } = await supabase
    .from("streamer_rooms")
    .select("*")
    .eq("room_code", roomCode)
    .eq("is_live", true)
    .maybeSingle();

  if (error) {
    console.warn("Supabase streamer room lookup failed", error);
    return { error };
  }

  return { room: data };
}

export async function updateStreamerAnswerState({ answerId, hidden, selectedForStream, selectedForOfficialBattle }) {
  if (!hasSupabaseConfig || !supabase || !isUuid(answerId)) return { skipped: true };

  const payload = {};
  if (typeof hidden === "boolean") payload.hidden = hidden;
  if (typeof selectedForStream === "boolean") payload.selected_for_stream = selectedForStream;
  if (typeof selectedForOfficialBattle === "boolean") {
    payload.selected_for_official_battle = selectedForOfficialBattle;
  }

  const { error } = await supabase.from("streamer_viewer_answers").update(payload).eq("id", answerId);
  if (error) {
    console.warn("Supabase streamer answer update failed", error);
    return { error };
  }

  return { ok: true };
}

export async function createFriendBattleRoom({ roomCode, category, prompt, hostName = "You" }) {
  if (!hasSupabaseConfig || !supabase) return { skipped: true };

  const playerPresenceId = presenceId();
  const { data, error } = await supabase
    .from("friend_battle_rooms")
    .upsert(
      {
        room_code: roomCode,
        category_id: category.id,
        prompt,
        host_presence_id: playerPresenceId,
        guest_presence_id: null,
        host_name: hostName,
        guest_name: null,
        host_submitted: false,
        guest_submitted: false,
        ai_winner_presence_id: null,
        ai_reason: null,
        point_delta: 18,
        status: "waiting",
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "room_code" },
    )
    .select()
    .single();

  if (error) {
    console.warn("Supabase friend room upsert failed", error);
    return { error };
  }

  return { room: data, playerPresenceId };
}

export async function joinFriendBattleRoom({ roomCode, guestName = "Friend" }) {
  if (!hasSupabaseConfig || !supabase) return { skipped: true };

  const playerPresenceId = presenceId();
  const { data: existing, error: lookupError } = await supabase
    .from("friend_battle_rooms")
    .select("*")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (lookupError) {
    console.warn("Supabase friend room lookup failed", lookupError);
    return { error: lookupError };
  }

  if (!existing) return { missing: true, playerPresenceId };

  if (existing.host_presence_id === playerPresenceId || existing.guest_presence_id === playerPresenceId) {
    return { room: existing, playerPresenceId };
  }

  const { data, error } = await supabase
    .from("friend_battle_rooms")
    .update({
      guest_presence_id: playerPresenceId,
      guest_name: guestName,
      status: "active",
    })
    .eq("room_code", roomCode)
    .select()
    .single();

  if (error) {
    console.warn("Supabase friend room join failed", error);
    return { error };
  }

  return { room: data, playerPresenceId };
}

export async function submitFriendBattleAnswer({ roomCode, answer, playerName = "You" }) {
  if (!hasSupabaseConfig || !supabase || !roomCode) return { skipped: true };

  const playerPresenceId = presenceId();
  const { error: answerError } = await supabase.from("friend_battle_answers").insert({
    room_code: roomCode,
    player_presence_id: playerPresenceId,
    player_name: playerName,
    answer,
  });

  if (answerError) {
    console.warn("Supabase friend answer insert failed", answerError);
    return { error: answerError };
  }

  const { data: room, error: roomLookupError } = await supabase
    .from("friend_battle_rooms")
    .select("*")
    .eq("room_code", roomCode)
    .single();

  if (roomLookupError) {
    console.warn("Supabase friend room submit lookup failed", roomLookupError);
    return { error: roomLookupError };
  }

  const isHost = room.host_presence_id === playerPresenceId;
  const hostSubmitted = isHost ? true : room.host_submitted;
  const guestSubmitted = isHost ? room.guest_submitted : true;
  const { error: roomUpdateError } = await supabase
    .from("friend_battle_rooms")
    .update({
      host_submitted: hostSubmitted,
      guest_submitted: guestSubmitted,
      status: "active",
    })
    .eq("room_code", roomCode);

  if (roomUpdateError) {
    console.warn("Supabase friend room submit update failed", roomUpdateError);
    return { error: roomUpdateError };
  }

  return { ok: true };
}

export async function getFriendBattleAnswers(roomCode) {
  if (!hasSupabaseConfig || !supabase || !roomCode) return { skipped: true, answers: [] };

  const { data, error } = await supabase
    .from("friend_battle_answers")
    .select("*")
    .eq("room_code", roomCode)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.warn("Supabase friend answers lookup failed", error);
    return { error, answers: [] };
  }

  return { answers: data ?? [] };
}

export async function markFriendBattleJudged({ roomCode, winnerPresenceId, reason, pointDelta = 18 }) {
  if (!hasSupabaseConfig || !supabase || !roomCode) return { skipped: true };

  const { error } = await supabase
    .from("friend_battle_rooms")
    .update({
      status: "judged",
      ai_winner_presence_id: winnerPresenceId,
      ai_reason: reason,
      point_delta: pointDelta,
    })
    .eq("room_code", roomCode);

  if (error) {
    console.warn("Supabase friend verdict update failed", error);
    return { error };
  }

  return { ok: true };
}

export async function findOrCreateRankedMatch({ category, prompt, playerName = "You" }) {
  if (!hasSupabaseConfig || !supabase) return { skipped: true };

  const playerPresenceId = presenceId();
  const { data: ticket, error: ticketError } = await supabase
    .from("ranked_matchmaking_tickets")
    .insert({
      category_id: category.id,
      player_presence_id: playerPresenceId,
      player_name: playerName,
    })
    .select()
    .single();

  if (ticketError) {
    console.warn("Supabase matchmaking ticket insert failed", ticketError);
    return { error: ticketError };
  }

  const { data: opponentTickets, error: searchError } = await supabase
    .from("ranked_matchmaking_tickets")
    .select("*")
    .eq("category_id", category.id)
    .eq("status", "waiting")
    .neq("player_presence_id", playerPresenceId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (searchError) {
    console.warn("Supabase matchmaking search failed", searchError);
    return { ticket, playerPresenceId, error: searchError };
  }

  const opponentTicket = opponentTickets?.[0];
  if (!opponentTicket) {
    return { ticket, playerPresenceId, waiting: true };
  }

  const { data: room, error: roomError } = await supabase
    .from("ranked_battle_rooms")
    .insert({
      category_id: category.id,
      prompt,
      host_ticket_id: opponentTicket.id,
      guest_ticket_id: ticket.id,
      host_presence_id: opponentTicket.player_presence_id,
      guest_presence_id: playerPresenceId,
      host_name: opponentTicket.player_name,
      guest_name: playerName,
    })
    .select()
    .single();

  if (roomError) {
    console.warn("Supabase ranked battle room insert failed", roomError);
    return { ticket, playerPresenceId, error: roomError };
  }

  const { error: ticketUpdateError } = await supabase
    .from("ranked_matchmaking_tickets")
    .update({ status: "matched", battle_room_id: room.id })
    .in("id", [opponentTicket.id, ticket.id]);

  if (ticketUpdateError) {
    console.warn("Supabase matchmaking ticket update failed", ticketUpdateError);
    return { ticket, room, playerPresenceId, opponentTicket, error: ticketUpdateError };
  }

  return { ticket, room, playerPresenceId, opponentTicket, matched: true };
}

export async function submitRankedBattleAnswer({ room, answer }) {
  if (!hasSupabaseConfig || !supabase || !room?.id) return { skipped: true };

  const playerPresenceId = presenceId();
  const isHost = playerPresenceId === room.host_presence_id;
  const hostSubmitted = isHost ? true : room.host_submitted;
  const guestSubmitted = isHost ? room.guest_submitted : true;
  const { error: answerError } = await supabase.from("ranked_battle_answers").insert({
    room_id: room.id,
    player_presence_id: playerPresenceId,
    answer,
  });

  if (answerError) {
    console.warn("Supabase ranked answer insert failed", answerError);
    return { error: answerError };
  }

  const { error: roomError } = await supabase
    .from("ranked_battle_rooms")
    .update({
      host_submitted: hostSubmitted,
      guest_submitted: guestSubmitted,
      status: hostSubmitted && guestSubmitted ? "judging" : "active",
    })
    .eq("id", room.id);

  if (roomError) {
    console.warn("Supabase ranked room submission update failed", roomError);
    return { error: roomError };
  }

  return { ok: true };
}

export async function getRankedBattleAnswers(roomId) {
  if (!hasSupabaseConfig || !supabase || !roomId) return { skipped: true, answers: [] };

  const { data, error } = await supabase
    .from("ranked_battle_answers")
    .select("*")
    .eq("room_id", roomId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.warn("Supabase ranked answers lookup failed", error);
    return { error, answers: [] };
  }

  return { answers: data ?? [] };
}

export async function markRankedBattleJudged({ roomId, winnerPresenceId, reason, pointDelta = 18 }) {
  if (!hasSupabaseConfig || !supabase || !roomId) return { skipped: true };

  const { error } = await supabase
    .from("ranked_battle_rooms")
    .update({
      status: "judged",
      ai_winner_presence_id: winnerPresenceId,
      ai_reason: reason,
      point_delta: pointDelta,
    })
    .eq("id", roomId);

  if (error) {
    console.warn("Supabase ranked verdict update failed", error);
    return { error };
  }

  return { ok: true };
}

export async function getRankedBattleRoom(roomId) {
  if (!hasSupabaseConfig || !supabase || !roomId) return { skipped: true };

  const { data, error } = await supabase
    .from("ranked_battle_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (error) {
    console.warn("Supabase ranked room lookup failed", error);
    return { error };
  }

  return { room: data };
}

export function subscribeToRankedTicket(ticketId, onChange) {
  if (!hasSupabaseConfig || !supabase || !ticketId) return { skipped: true, unsubscribe: () => {} };

  const channel = supabase
    .channel(`ranked-ticket:${ticketId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "ranked_matchmaking_tickets",
        filter: `id=eq.${ticketId}`,
      },
      onChange,
    )
    .subscribe();

  return {
    skipped: false,
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

export function subscribeToRankedBattle(roomId, onChange) {
  if (!hasSupabaseConfig || !supabase || !roomId) return { skipped: true, unsubscribe: () => {} };

  const channel = supabase
    .channel(`ranked-battle:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "ranked_battle_rooms",
        filter: `id=eq.${roomId}`,
      },
      onChange,
    )
    .subscribe();

  return {
    skipped: false,
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

export function subscribeToStreamerAnswers(roomCode, onChange) {
  if (!hasSupabaseConfig || !supabase) return { skipped: true, unsubscribe: () => {} };

  const channel = supabase
    .channel(`streamer-viewer-answers:${roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "streamer_viewer_answers",
        filter: `room_code=eq.${roomCode}`,
      },
      onChange,
    )
    .subscribe();

  return {
    skipped: false,
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

export function subscribeToStreamerRoom(roomCode, onChange) {
  if (!hasSupabaseConfig || !supabase || !roomCode) return { skipped: true, unsubscribe: () => {} };

  const channel = supabase
    .channel(`streamer-room:${roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "streamer_rooms",
        filter: `room_code=eq.${roomCode}`,
      },
      onChange,
    )
    .subscribe();

  return {
    skipped: false,
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

export function subscribeToFriendRoom(roomCode, onChange) {
  if (!hasSupabaseConfig || !supabase) return { skipped: true, unsubscribe: () => {} };

  const channel = supabase
    .channel(`friend-room:${roomCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "friend_battle_rooms",
        filter: `room_code=eq.${roomCode}`,
      },
      onChange,
    )
    .subscribe();

  return {
    skipped: false,
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
