"use client";import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
interface Tournament {
  id: string;
  tournamentName: string;
  status: string;
  teams: Team[];
}

interface Player {
  id: string;
  playerName: string;
  playerImage: string | null;
  position: number;
}

interface Team {
  id: string;
  teamName: string;
  slotNumber: number;
  teamImage: string | null;
  players: Player[];
  teamColor: string | null;
}

export default function AdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [tournamentName, setTournamentName] = useState("");
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [tournamentStatus, setTournamentStatus] = useState<string>("");

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchTeams();
    }
  }, [selectedTournament]);

  const isActive = tournamentStatus === "active";

  const handleToggle = async () => {
    setTournamentStatus(isActive ? "inactive" : "active");
    const res = await fetch(`/api/tournaments`, {
      method: "PATCH",
      body: JSON.stringify({
        id: selectedTournament,
        status: isActive ? "inactive" : "active",
      }),
    });
    if (res.ok) {
      toast.success("Tournament status updated successfully");
    } else {
      toast.error("Failed to update tournament status");
    }
  };

  const fetchTournaments = async () => {
    try {
      const res = await fetch("/api/tournaments");
      const data = await res.json();
      setTournaments(data);
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
      toast.error("Failed to fetch tournaments");
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams/" + selectedTournament);
      const data = await res.json();
      setTeams(data);
      setTournamentStatus(data[0].tournament.status);
    } catch {
      toast.error("Failed to fetch teams:");
    }
  };

  const handleAddTournament = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tournaments", {
        method: "POST",
        body: JSON.stringify(tournamentName),
      });

      if (res.ok) {
        const tournaments = await res.json();
        console.log(tournaments);

        setTournaments(tournaments);
        setTournamentName("");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to add tournament");
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to add tournament:", error);
      setLoading(false);
      toast.error("Failed to add tournament");
    }
  };

  const handleDeleteTournament = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tournaments`, {
        method: "DELETE",
        body: JSON.stringify(selectedTournament),
      });

      if (res.ok) {
        const tournaments = await res.json();
        setTournaments(tournaments);
        setSelectedTournament("");
        toast.success("Tournament deleted successfully");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete tournament");
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to delete tournament:", error);
      setLoading(false);
      toast.error("Failed to delete tournament");
    }
  };

  const handleBulkImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setLoading(true);
    try {
      // Find first available slots (starting from 1)
      const occupiedSlots = new Set(teams.map((t) => t.slotNumber));
      const availableSlots: number[] = [];
      for (let i = 1; i <= 25 && availableSlots.length < files.length; i++) {
        if (!occupiedSlots.has(i)) {
          availableSlots.push(i);
        }
      }

      if (availableSlots.length < files.length) {
        toast.info(
          `Only ${availableSlots.length} slots available. Please select fewer images or reset some teams.`,
        );
        setLoading(false);
        return;
      }

      // Prepare form data for bulk upload
      const formData = new FormData();
      const teamsData = files.map((file, index) => ({
        slotNumber: availableSlots[index],
        teamName: `Team ${availableSlots[index]}`, // Placeholder name
        players: Array.from({ length: 4 }, () => ({ playerName: "" })),
      }));

      formData.append("teams", JSON.stringify(teamsData));

      // Add team images
      files.forEach((file, index) => {
        formData.append(`teamImage-${availableSlots[index]}`, file);
      });

      const res = await fetch("/api/teams", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchTeams();
        toast.success(
          `Successfully added ${files.length} team(s)! You can now edit team names and add player information.`,
        );
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to add teams");
      }
    } catch (error) {
      console.error("Failed to upload teams:", error);
      toast.error("Failed to upload teams");
    } finally {
      setLoading(false);
      // Reset file input
      e.target.value = "";
    }
  };

  const handleResetTeam = async (teamId: string) => {
    if (
      !confirm(
        "Are you sure you want to reset this team? All images will be deleted from S3.",
      )
    )
      return;

    try {
      const res = await fetch(`/api/teams/${teamId}/reset`, { method: "POST" });
      if (res.ok) {
        await fetchTeams();
        alert("Team reset successfully!");
      } else {
        alert("Failed to reset team");
      }
    } catch (error) {
      console.error("Failed to reset team:", error);
      alert("Failed to reset team");
    }
  };

  const handleResetAll = async () => {
    if (
      !confirm(
        "Are you sure you want to reset ALL teams? This will delete all teams and images from S3. This cannot be undone.",
      )
    )
      return;

    try {
      const res = await fetch("/api/teams/reset", { method: "POST" });
      if (res.ok) {
        await fetchTeams();
        alert("All teams reset successfully!");
      } else {
        alert("Failed to reset all teams");
      }
    } catch (error) {
      console.error("Failed to reset all teams:", error);
      alert("Failed to reset all teams");
    }
  };

  // Create slots array (1-25)
  const slots = Array.from({ length: 25 }, (_, i) => i + 1);
  const teamsBySlot = teams?.reduce(
    (acc, team) => {
      acc[team.slotNumber] = team;
      return acc;
    },
    {} as Record<number, Team>,
  );

  const handleSlotSwap = async (teamId: string, targetSlot: number) => {
    try {
      const res = await fetch("/api/teams/swap", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTeamId: teamId,
          targetSlot,
        }),
      });

      if (res.ok) {
        await fetchTeams();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to swap slots");
      }
    } catch (err) {
      console.error("Swap failed:", err);
      toast.error("Swap failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">BGMI Team Dashboard</h1>
          <div className="flex gap-4 flex-col">
            <div className="flex gap-4 items-center w-full">
              <div className="flex gap-4 items-center justify-end ">
                <div>
                  <select
                    name="tournamentName"
                    id="tournamentName"
                    className="bg-gray-700 py-2 px-4 rounded-lg text-white"
                    onChange={(e) => {
                      setSelectedTournament(e.target.value);
                    }}
                  >
                    <option value="">Select Tournament</option>
                    {tournaments.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>
                        {tournament.tournamentName}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="Tournament Name"
                  className="w-full h-10 px-2 bg-gray-700 rounded text-white text-sm"
                  required
                />
                <button
                  className="px-6 py-3 w-full bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold cursor-pointer"
                  onClick={handleAddTournament}
                  disabled={loading}
                >
                  {loading ? "Adding..." : "+ Add Tournament"}
                </button>
              </div>
              <div>
                <button
                  className="px-2 py-3 w-full bg-red-600 hover:bg-red-700 rounded-lg font-semibold cursor-pointer "
                  style={{
                    display: selectedTournament ? "block" : "none",
                  }}
                  onClick={handleDeleteTournament}
                  disabled={loading}
                >
                  Delete Tournament
                </button>
              </div>
              <div>
                <div
                  onClick={handleToggle}
                  style={{
                    display: selectedTournament ? "block" : "none",
                    width: "50px",
                    height: "26px",
                    borderRadius: "999px",
                    backgroundColor: isActive ? "#1447e6" : "#ccc",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 0.3s",
                  }}
                >
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      backgroundColor: "#fff",
                      position: "absolute",
                      top: "2px",
                      left: isActive ? "26px" : "2px",
                      transition: "left 0.3s",
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-4 items-center justify-end ">
              <label className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold cursor-pointer">
                {loading ? "Uploading..." : "Bulk Add Team Images"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBulkImageSelect}
                  disabled={loading}
                  className="hidden"
                />
              </label>
              <button
                suppressHydrationWarning
                onClick={handleResetAll}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {slots.map((slot) => {
            const team = teamsBySlot[slot];
            return (
              <TeamSlot
                key={slot}
                slotNumber={slot}
                team={team}
                tournamentId={selectedTournament}
                onReset={handleResetTeam}
                onUpdate={fetchTeams}
                onSlotSwap={handleSlotSwap}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmptySlot({
  slotNumber,
  onAdd,
  tournamentId,
}: {
  slotNumber: number;
  onAdd: () => void;
  tournamentId: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [playerNames, setPlayerNames] = useState<string[]>(Array(4).fill(""));
  const [loading, setLoading] = useState(false);
  const [teamColor, setTeamColor] = useState("#ffffff");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();

      // Prepare teams data for API
      const teamsData = [
        {
          slotNumber,
          teamName: teamName || `Team ${slotNumber}`,
          teamColor,
          players: playerNames.map((name) => ({ playerName: name })),
        },
      ];
      formData.append("tournamentId", tournamentId);
      formData.append("teams", JSON.stringify(teamsData));

      // Handle file inputs for team image and player images
      const formElement = e.currentTarget;
      const teamImageInput = formElement.querySelector<HTMLInputElement>(
        'input[name="teamImage"]',
      );
      if (teamImageInput?.files?.[0]) {
        formData.append(`teamImage-${slotNumber}`, teamImageInput.files[0]);
      }

      for (let i = 0; i < 4; i++) {
        const playerImageInput = formElement.querySelector<HTMLInputElement>(
          `input[name="playerImage-${i}"]`,
        );
        if (playerImageInput?.files?.[0]) {
          formData.append(
            `playerImage-${slotNumber}-${i}`,
            playerImageInput.files[0],
          );
        }
      }

      const res = await fetch("/api/teams", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setIsAdding(false);
        setTeamName("");
        setPlayerNames(Array(4).fill(""));
        onAdd();
        toast.success("Team added successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to add team");
      }
    } catch (error) {
      console.error("Failed to add team:", error);
      alert("Failed to add team");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdding) {
    return (
      <div className="text-gray-500 text-center py-12">
        <p className="mb-3">Empty Slot {slotNumber}</p>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white"
          disabled={tournamentId === ""}
        >
          Add Team
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="mb-2">
        <div className="w-full h-24 bg-gray-700 rounded flex items-center justify-center text-gray-500 text-sm mb-1">
          No Image
        </div>
        <input
          type="file"
          name="teamImage"
          accept="image/*"
          className="w-full text-xs text-gray-400"
        />
      </div>
      <input
        type="text"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        placeholder="Team Name"
        className="w-full px-2 py-1 bg-gray-700 rounded text-white mb-2 text-sm"
      />
      <label className="text-xs text-gray-400">Team Color</label>
      <input
        type="color"
        value={teamColor}
        onChange={(e) => setTeamColor(e.target.value)}
        className="w-full h-10 rounded cursor-pointer"
      />

      <div className="space-y-2 mb-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="space-y-1">
            <input
              type="text"
              value={playerNames[idx] || ""}
              onChange={(e) => {
                const updated = [...playerNames];
                updated[idx] = e.target.value;
                setPlayerNames(updated);
              }}
              placeholder={`Player ${idx + 1} Name`}
              className="w-full px-2 py-1 bg-gray-700 rounded text-white text-xs"
            />
            <input
              type="file"
              name={`playerImage-${idx}`}
              accept="image/*"
              className="w-full text-xs text-gray-400"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsAdding(false);
            setTeamName("");
            setPlayerNames(Array(4).fill(""));
            setTeamColor("#ffffff");
          }}
          className="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function TeamSlot({
  slotNumber,
  team,
  onReset,
  onUpdate,
  onSlotSwap,
  tournamentId,
}: {
  slotNumber: number;
  team?: Team;
  tournamentId: string;
  onReset: (teamId: string) => void;
  onUpdate: () => Promise<void>;
  onSlotSwap: (teamId: string, targetSlot: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [teamName, setTeamName] = useState(team?.teamName || "");
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [teamColor, setTeamColor] = useState(team?.teamColor || "#ffffff");

  useEffect(() => {
    setTeamColor(team?.teamColor || "#ffffff");
  }, [team]);

  useEffect(() => {
    setTeamName(team?.teamName || "");
    if (team?.players) {
      const sorted = team.players.sort((a, b) => a.position - b.position);
      setPlayerNames(sorted.map((p) => p.playerName || ""));
    } else {
      setPlayerNames(Array(4).fill(""));
    }
  }, [team]);

  const sortedPlayers =
    team?.players.sort((a, b) => a.position - b.position) || [];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!team) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("teamColor", teamColor);
      formData.append("teamName", teamName);

      // Add player names
      playerNames.forEach((name, idx) => {
        formData.append(`playerName-${idx}`, name);
      });

      // Handle file inputs for team image and player images
      const formElement = e.currentTarget;
      const teamImageInput = formElement.querySelector<HTMLInputElement>(
        'input[name="teamImage"]',
      );
      if (teamImageInput?.files?.[0]) {
        formData.append("teamImage", teamImageInput.files[0]);
      }

      for (let i = 0; i < 4; i++) {
        const playerImageInput = formElement.querySelector<HTMLInputElement>(
          `input[name="playerImage-${i}"]`,
        );
        if (playerImageInput?.files?.[0]) {
          formData.append(`playerImage-${i}`, playerImageInput.files[0]);
        }
      }

      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        body: formData,
      });

      if (res.ok) {
        setIsEditing(false);
        onUpdate();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update team");
      }
    } catch (error) {
      console.error("Failed to update team:", error);
      alert("Failed to update team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      draggable={!!team}
      onDragStart={(e) => {
        if (!team) return;
        e.dataTransfer.setData("teamId", team.id);
        e.dataTransfer.setData("sourceSlot", slotNumber.toString());
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.classList.add("ring-2", "ring-blue-500");
      }}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove("ring-2", "ring-blue-500");
      }}
      onDrop={async (e) => {
        e.preventDefault();
        const teamId = e.dataTransfer.getData("teamId");
        const sourceSlot = Number(e.dataTransfer.getData("sourceSlot"));

        if (!teamId || sourceSlot === slotNumber) return;

        await onSlotSwap(teamId, slotNumber);
      }}
      className="bg-gray-800 rounded-lg p-4 border-2 border-gray-700 min-h-[300px]"
      style={{ borderColor: team?.teamColor || "#E4E5E7" }}
    >
      <div className="mb-2">
        <label className="text-sm text-gray-400">Slot</label>
        <input
          type="number"
          value={slotNumber}
          readOnly
          className="w-full px-2 py-1 bg-gray-700 rounded text-white cursor-not-allowed"
        />
      </div>

      {team ? (
        isEditing ? (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="mb-2">
              {team.teamImage ? (
                <Image
                  src={team.teamImage}
                  alt={team.teamName}
                  width={100}
                  height={100}
                  className="w-full h-24 object-cover rounded"
                  unoptimized
                  loading="eager"
                />
              ) : (
                <div className="w-full h-24 bg-gray-700 rounded flex items-center justify-center text-gray-500 text-sm">
                  No Image
                </div>
              )}
              <input
                type="file"
                name="teamImage"
                accept="image/*"
                className="w-full text-xs text-gray-400 mt-1"
              />
            </div>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team Name"
              className="w-full px-2 py-1 bg-gray-700 rounded text-white mb-2 text-sm"
            />
            <label className="text-xs text-gray-400">Team Color</label>
            <input
              type="color"
              value={teamColor}
              onChange={(e) => setTeamColor(e.target.value)}
              className="w-full h-10 rounded cursor-pointer"
            />

            <div className="space-y-2 mb-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={playerNames[idx] || ""}
                      onChange={(e) => {
                        const updated = [...playerNames];
                        updated[idx] = e.target.value;
                        setPlayerNames(updated);
                      }}
                      placeholder={`Player ${idx + 1} Name`}
                      className="flex-1 px-2 py-1 bg-gray-700 rounded text-white text-xs"
                    />
                  </div>
                  <input
                    type="file"
                    name={`playerImage-${idx}`}
                    accept="image/*"
                    className="w-full text-xs text-gray-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setTeamName(team.teamName);
                  setPlayerNames(sortedPlayers.map((p) => p.playerName || ""));
                  setTeamColor(team.teamColor || "#ffffff");
                }}
                className="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="mb-2">
              {team.teamImage ? (
                <Image
                  src={team.teamImage}
                  alt={team.teamName}
                  width={100}
                  height={100}
                  className="w-full h-24 object-cover rounded"
                  unoptimized
                />
              ) : (
                <div className="w-full h-24 bg-gray-700 rounded flex items-center justify-center text-gray-500 text-sm">
                  No Image
                </div>
              )}
            </div>
            <input
              type="text"
              value={team.teamName}
              readOnly
              className="w-full px-2 py-1 bg-gray-700 rounded text-white mb-2 text-sm"
            />
            <div className="space-y-1 mb-3">
              {sortedPlayers.map((player, idx) => (
                <div
                  key={player.id || idx}
                  className="flex gap-2 items-center "
                >
                  {player.playerImage ? (
                    <Image
                      src={player.playerImage}
                      alt={player.playerName}
                      width={30}
                      height={30}
                      className="w-8 h-8 object-cover rounded "
                      unoptimized
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-600 rounded " />
                  )}
                  <span className="text-xs flex-1 truncate">
                    {player.playerName || "N/A"}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => onReset(team.id)}
                className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
              >
                Reset
              </button>
            </div>
          </div>
        )
      ) : (
        <EmptySlot
          slotNumber={slotNumber}
          onAdd={onUpdate}
          tournamentId={tournamentId}
        />
      )}
    </div>
  );
}
