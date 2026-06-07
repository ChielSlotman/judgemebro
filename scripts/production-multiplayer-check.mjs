import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const envFiles = [".env.production.vercel.local", ".env.vercel.local", ".env.local"];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const rawValue = line.slice(index + 1).trim();
        const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

function readEnv() {
  return envFiles.reduce(
    (env, fileName) => ({ ...env, ...parseEnvFile(join(rootDir, fileName)) }),
    { ...process.env },
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function failFromSupabase(error, label) {
  if (!error) return;
  throw new Error(`${label}: ${error.message}${error.code ? ` (${error.code})` : ""}`);
}

function randomCode() {
  return `QA${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function updateRows(client, table, payload, column, value, label) {
  const { error } = await client.from(table).update(payload).eq(column, value);
  failFromSupabase(error, label);
}

async function checkFriendBattle(client) {
  const roomCode = randomCode();
  const hostPresenceId = `qa-host-${crypto.randomUUID()}`.slice(0, 80);
  const guestPresenceId = `qa-guest-${crypto.randomUUID()}`.slice(0, 80);

  try {
    const { error: createRoomError } = await client.from("friend_battle_rooms").insert({
      room_code: roomCode,
      category_id: "business",
      prompt: "A client says your price is too high. What do you reply?",
      host_presence_id: hostPresenceId,
      guest_presence_id: null,
      host_name: "QA Host",
      guest_name: null,
      host_submitted: false,
      guest_submitted: false,
      status: "waiting",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    failFromSupabase(createRoomError, "friend room create failed");

    await updateRows(
      client,
      "friend_battle_rooms",
      { guest_presence_id: guestPresenceId, guest_name: "QA Guest", status: "active" },
      "room_code",
      roomCode,
      "friend room join failed",
    );

    const { error: hostAnswerError } = await client.from("friend_battle_answers").insert({
      room_code: roomCode,
      player_presence_id: hostPresenceId,
      player_name: "QA Host",
      answer: "I can reduce scope, not quality. Which part matters most?",
    });
    failFromSupabase(hostAnswerError, "friend host answer submit failed");

    await updateRows(
      client,
      "friend_battle_rooms",
      { host_submitted: true, guest_submitted: false, status: "active" },
      "room_code",
      roomCode,
      "friend host submit flag failed",
    );

    const { error: guestAnswerError } = await client.from("friend_battle_answers").insert({
      room_code: roomCode,
      player_presence_id: guestPresenceId,
      player_name: "QA Guest",
      answer: "I understand. I can give you a discount.",
    });
    failFromSupabase(guestAnswerError, "friend guest answer submit failed");

    await updateRows(
      client,
      "friend_battle_rooms",
      { host_submitted: true, guest_submitted: true, status: "active" },
      "room_code",
      roomCode,
      "friend guest submit flag failed",
    );

    const { data: answers, error: answersError } = await client
      .from("friend_battle_answers")
      .select("player_presence_id, answer")
      .eq("room_code", roomCode);
    failFromSupabase(answersError, "friend answer reveal query failed");
    assert(
      Array.isArray(answers) && answers.length === 2,
      `friend answer reveal policy is not ready; expected 2 answers before AI judgment, received ${answers?.length ?? 0}`,
    );

    return { roomCode, answers: answers.length };
  } finally {
    await client.from("friend_battle_rooms").update({ status: "cancelled" }).eq("room_code", roomCode);
  }
}

async function checkRankedBattle(client) {
  const hostPresenceId = `qa-host-${crypto.randomUUID()}`.slice(0, 80);
  const guestPresenceId = `qa-guest-${crypto.randomUUID()}`.slice(0, 80);
  let roomId = null;

  try {
    const { data: room, error: createRoomError } = await client
      .from("ranked_battle_rooms")
      .insert({
        category_id: "business",
        prompt: "A client says your price is too high. What do you reply?",
        host_presence_id: hostPresenceId,
        guest_presence_id: guestPresenceId,
        host_name: "QA Host",
        guest_name: "QA Guest",
        host_submitted: false,
        guest_submitted: false,
        status: "active",
      })
      .select("id")
      .single();
    failFromSupabase(createRoomError, "ranked room create failed");
    roomId = room.id;

    const { error: hostAnswerError } = await client.from("ranked_battle_answers").insert({
      room_id: roomId,
      player_presence_id: hostPresenceId,
      answer: "I can reduce scope, not quality. Which part matters most?",
    });
    failFromSupabase(hostAnswerError, "ranked host answer submit failed");

    const { error: guestAnswerError } = await client.from("ranked_battle_answers").insert({
      room_id: roomId,
      player_presence_id: guestPresenceId,
      answer: "I understand. I can give you a discount.",
    });
    failFromSupabase(guestAnswerError, "ranked guest answer submit failed");

    await updateRows(
      client,
      "ranked_battle_rooms",
      { host_submitted: true, guest_submitted: true, status: "judging" },
      "id",
      roomId,
      "ranked room judging flag failed",
    );

    const { data: answers, error: answersError } = await client
      .from("ranked_battle_answers")
      .select("player_presence_id, answer")
      .eq("room_id", roomId);
    failFromSupabase(answersError, "ranked answer reveal query failed");
    assert(
      Array.isArray(answers) && answers.length === 2,
      `ranked answer reveal policy is not ready; expected 2 answers before AI judgment, received ${answers?.length ?? 0}`,
    );

    return { roomId, answers: answers.length };
  } finally {
    if (roomId) await client.from("ranked_battle_rooms").update({ status: "cancelled" }).eq("id", roomId);
  }
}

const env = readEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

assert(supabaseUrl, "Missing VITE_SUPABASE_URL in env or .env.production.vercel.local");
assert(supabaseKey, "Missing VITE_SUPABASE_PUBLISHABLE_KEY in env or .env.production.vercel.local");

const client = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const friend = await checkFriendBattle(client);
const ranked = await checkRankedBattle(client);

console.log(
  JSON.stringify(
    {
      ok: true,
      checks: {
        friendBattleAnswersReadableBeforeJudge: friend,
        rankedBattleAnswersReadableBeforeJudge: ranked,
      },
    },
    null,
    2,
  ),
);
