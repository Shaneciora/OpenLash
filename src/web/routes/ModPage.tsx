import { useState } from "react";
import { useParams } from "react-router-dom";
import { useGameSocket } from "../hooks/useGameSocket";
import { clientEvents } from "../../shared/protocol";

export function ModPage() {
  const { code } = useParams();
  const { joinRoom, socket } = useGameSocket();
  const [modPassword, setModPassword] = useState("");
  const [queue, setQueue] = useState<{ id: string; playerName: string; text: string }[]>([]);
  const [joined, setJoined] = useState(false);

  const handleJoin = async () => {
    await joinRoom({
      code: code ?? "",
      name: "Moderator",
      role: "mod",
      modPassword,
    });
    setJoined(true);
  };

  socket?.on("mod_queue", (q: typeof queue) => setQueue(q));

  const decide = (itemId: string, approved: boolean) => {
    socket?.emit(clientEvents.MOD_DECISION, { itemId, approved });
    setQueue((q) => q.filter((i) => i.id !== itemId));
  };

  if (!joined) {
    return (
      <div className="play-screen">
        <h1>Moderator</h1>
        <input
          placeholder="Mod password"
          value={modPassword}
          onChange={(e) => setModPassword(e.target.value)}
        />
        <button onClick={handleJoin}>Join</button>
      </div>
    );
  }

  return (
    <div className="play-screen">
      <h1>Moderation Queue</h1>
      {queue.length === 0 && <p>No items pending</p>}
      {queue.map((item) => (
        <div key={item.id} className="card" style={{ marginBottom: 12 }}>
          <strong>{item.playerName}</strong>
          <p>{item.text}</p>
          <button onClick={() => decide(item.id, true)}>Approve</button>
          <button onClick={() => decide(item.id, false)}>Reject</button>
        </div>
      ))}
    </div>
  );
}
