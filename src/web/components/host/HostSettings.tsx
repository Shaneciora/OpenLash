import { useEffect, useState, type ReactNode } from "react";
import type { BotTestLobbyMode, PublicRoomState } from "../../../shared/types";
import type { z } from "zod";
import type { updateSettingsSchema } from "../../../shared/protocol";

type SettingsPatch = z.infer<typeof updateSettingsSchema>;

interface Props {
  state: PublicRoomState;
  onUpdate: (patch: SettingsPatch) => void;
}

const BOT_MODES: { mode: BotTestLobbyMode; label: string; testId: string }[] = [
  { mode: "max", label: "At game start only", testId: "max" },
  { mode: "lobby_3", label: "3 players (you + 2 bots)", testId: "lobby-3" },
  { mode: "lobby_7", label: "7 players (you + 6 bots)", testId: "lobby-7" },
  {
    mode: "lobby_full",
    label: "Full lobby",
    testId: "lobby-full",
  },
];

function SettingRow({
  testId,
  inputTestId,
  checked,
  onChange,
  children,
}: {
  testId?: string;
  inputTestId?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="ui-toggle-row" data-testid={testId}>
      <input
        type="checkbox"
        className="ui-toggle-input"
        data-testid={inputTestId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-toggle-track" aria-hidden />
      <span className="ui-toggle-label">{children}</span>
    </label>
  );
}

export function HostSettings({ state, onUpdate }: Props) {
  const [passwordDraft, setPasswordDraft] = useState(state.settings.password ?? "");

  useEffect(() => {
    setPasswordDraft(state.settings.password ?? "");
  }, [state.settings.password]);

  if (state.phase !== "lobby") return null;

  const s = state.settings;
  const joinedPlayers = state.players.filter((p) => !p.isAudience && !p.kicked).length;
  const maxPlayerOptions = Array.from({ length: 18 }, (_, i) => i + 3).filter(
    (n) => n >= joinedPlayers
  );

  const patch = (p: SettingsPatch) => onUpdate(p);

  const commitPassword = () => {
    const next = passwordDraft.trim() || null;
    if (next !== s.password) patch({ password: next });
  };

  const setBotMode = (mode: BotTestLobbyMode, enabled: boolean) => {
    patch({ botTestLobbyMode: enabled ? mode : "off" });
  };

  return (
    <aside className="host-settings-panel card" data-testid="host-settings-panel">
      <h2 className="host-panel-title">Settings</h2>

      <div className="host-settings-group">
        <label className="host-field-label" htmlFor="lobby-password">
          Room password
        </label>
        <input
          id="lobby-password"
          type="password"
          className="ui-input"
          data-testid="lobby-password-input"
          placeholder="None"
          value={passwordDraft}
          onChange={(e) => setPasswordDraft(e.target.value)}
          onBlur={commitPassword}
          onKeyDown={(e) => e.key === "Enter" && commitPassword()}
          autoComplete="off"
        />
      </div>

      <div className="host-settings-group">
        <span className="host-field-label">Announcer</span>
        <SettingRow
          testId="narrator-setting"
          inputTestId="narrator-toggle"
          checked={s.narratorEnabled}
          onChange={(narratorEnabled) => patch({ narratorEnabled })}
        >
          Narrator voice
        </SettingRow>
        <SettingRow
          testId="subtitles-setting"
          inputTestId="subtitles-toggle"
          checked={s.subtitles}
          onChange={(subtitles) => patch({ subtitles })}
        >
          Subtitles on screen
        </SettingRow>
      </div>

      <div className="host-settings-group">
        <span className="host-field-label">Game</span>
        <label className="host-field-label" htmlFor="final-round-mode">
          Final round
        </label>
        <select
          id="final-round-mode"
          className="ui-select"
          data-testid="final-round-select"
          value={s.finalRoundMode}
          onChange={(e) =>
            patch({ finalRoundMode: e.target.value as typeof s.finalRoundMode })
          }
        >
          <option value="thriplash">Thriplash</option>
          <option value="last_lash">Last Lash</option>
        </select>
        <label className="host-field-label" htmlFor="max-players">
          Max players
        </label>
        <select
          id="max-players"
          className="ui-select"
          data-testid="max-players-select"
          value={s.maxPlayers}
          onChange={(e) => patch({ maxPlayers: Number(e.target.value) })}
        >
          {maxPlayerOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="host-settings-group">
        <span className="host-field-label">Debug</span>
        {BOT_MODES.map(({ mode, label, testId }) => (
          <SettingRow
            key={mode}
            testId={`bot-mode-${testId}-setting`}
            inputTestId={`bot-mode-${testId}-toggle`}
            checked={s.botTestLobbyMode === mode}
            onChange={(enabled) => setBotMode(mode, enabled)}
          >
            {mode === "lobby_full"
              ? `${label} (${s.maxPlayers} players, you + ${s.maxPlayers - 1} bots)`
              : label}
          </SettingRow>
        ))}
      </div>

      <div className="host-settings-group">
        <span className="host-field-label">Display</span>
        <SettingRow
          checked={s.roomCodeHidden}
          onChange={(roomCodeHidden) => patch({ roomCodeHidden })}
        >
          Hide code until revealed
        </SettingRow>
      </div>
    </aside>
  );
}
