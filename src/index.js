const MIN_PLAYERS = 2;
const CHOOSE_DELAY_MS = 2000;
const RESET_DELAY_MS = 1000;

// ----- Mode system -----
// "single" preserves the original random-pick behaviour.
// "group" divides touches into colour-coded groups (random assignment after a short wait).
const MODE_SINGLE = "single";
const MODE_GROUP = "group";
let currentMode = MODE_SINGLE;

// ----- Group configuration -----
const MIN_GROUPS = 2;
const MAX_GROUPS = 8;
let groupCount = 2; // number of active groups (user-configurable, default 2)

// Distinct HSL hues chosen for good visual separation and accessibility
const GROUP_HUES = [0, 220, 130, 35, 280, 180, 330, 60];

/** Returns an hsla() colour string for the given group index. */
const groupColor = (groupIndex, alpha = 1) =>
	`hsla(${GROUP_HUES[groupIndex % GROUP_HUES.length]}, 80%, 55%, ${alpha})`;

// ----- DOM references -----
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const description = document.getElementById("description");
const ariaLive = document.getElementById("live-region");
const version = document.getElementById("version");
const updateAvailable = document.getElementById("update-available");
const modeBtns = document.querySelectorAll(".mode-btn");
const groupControls = document.getElementById("group-controls");
const groupCountLabel = document.getElementById("group-count-label");
const groupDecBtn = document.getElementById("group-dec");
const groupIncBtn = document.getElementById("group-inc");
const groupLegend = document.getElementById("group-legend");

// ----- Player state -----
const players = new Map();
let chosenPlayer;
const chosenPlayerAnimation = {
	startTime: 0,
	startValue: 0,
};

// ----- Accessibility helpers -----
const ariaLiveLog = (msg) => {
	const element = document.createElement("div");
	element.textContent = msg;
	ariaLive.append(element);
};

const ariaLiveReset = () => {
	ariaLive.innerHTML = "";
	ariaLiveLog("Reset");
};

// ----- Canvas sizing -----
const resizeCanvas = () => {
	canvas.width = Math.floor(window.innerWidth);
	canvas.height = Math.floor(window.innerHeight);
};
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ----- Colour helpers -----
/** Single-mode colour: cycles through hues based on player index. */
const color = (index, alpha = 1) =>
	`hsla(${index * 222.5 + 348}, 100%, 51.4%, ${alpha})`;

/**
 * Resolves the display colour for a player in the current mode.
 * In single mode, uses the hue-cycling palette.
 * In group mode, uses the fixed group palette, or white while the player
 * is still pending (waiting for group assignment).
 */
const resolvePlayerColor = (player, alpha = 1) => {
	if (currentMode === MODE_GROUP) {
		if (player.groupIndex === undefined) {
			// Pending – waiting for group assignment; show as white
			return `hsla(0, 0%, 100%, ${alpha})`;
		}
		return groupColor(player.groupIndex, alpha);
	}
	return color(player.color, alpha);
};

// ----- Drawing -----
const drawPlayer = (player) => {
	const c = resolvePlayerColor(player);
	ctx.beginPath();
	ctx.strokeStyle = c;
	ctx.lineWidth = 10;
	ctx.arc(player.x, player.y, 50, 0, 2 * Math.PI);
	ctx.stroke();
	ctx.beginPath();
	ctx.fillStyle = c;
	ctx.arc(player.x, player.y, 35, 0, 2 * Math.PI);
	ctx.fill();
};

const easeOutQuint = (t) => 1 + --t * t * t * t * t;

const draw = (function () {
	const draw = () => {
		// Clear canvas each frame
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (chosenPlayer !== undefined) {
			// Show only the chosen player with a closing-spotlight animation
			description.hidden = true;
			const player = players.get(chosenPlayer);
			drawPlayer(player);

			const { startTime, startValue } = chosenPlayerAnimation;
			const endValue = 90;
			const elapsed = Date.now() - startTime;
			const duration = RESET_DELAY_MS;
			const t = elapsed / duration;
			const value =
				t < 1
					? startValue - (startValue - endValue) * easeOutQuint(t)
					: endValue;

			// Draw a coloured overlay with an evenodd hole centred on the player,
			// creating a "spotlight closes in" reveal effect.
			ctx.beginPath();
			ctx.fillStyle = resolvePlayerColor(player);
			ctx.rect(0, 0, canvas.width, canvas.height);
			ctx.arc(player.x, player.y, value, 0, 2 * Math.PI);
			ctx.fill("evenodd");

			return t < 1;
		} else if (players.size > 0) {
			// Show all active players
			description.hidden = true;
			for (const player of players.values()) {
				drawPlayer(player);
			}

			return false;
		} else {
			// No players – show the help text
			description.hidden = false;
			return false;
		}
	};

	let running = false;
	const run = () => {
		if (draw()) {
			window.requestAnimationFrame(run);
		} else {
			running = false;
		}
	};
	return () => {
		if (!running) {
			window.requestAnimationFrame(run);
			running = true;
		}
	};
})();

// ----- Group legend UI -----
/** Clears all players and resets group state. */
const clearAll = () => {
	chosenPlayer = undefined;
	players.clear();
	ariaLiveReset();
	draw();
	updateGroupLegend();
};

/**
 * Rebuilds the group legend chips showing each group's colour and
 * how many active touches belong to it, plus a "Clear All" button.
 * Called whenever players are added/removed or the mode changes.
 */
const updateGroupLegend = () => {
	if (currentMode !== MODE_GROUP) return;

	// Count active touches per group
	const counts = new Array(groupCount).fill(0);
	for (const player of players.values()) {
		if (player.groupIndex >= 0 && player.groupIndex < groupCount) {
			counts[player.groupIndex]++;
		}
	}

	// Build chip HTML for each group (A, B, C, …)
	let html = "";
	for (let i = 0; i < groupCount; i++) {
		const c = groupColor(i);
		html += `<span class="group-chip" style="--group-color:${c}">` +
			`<span class="group-chip-dot"></span>` +
			`<span class="group-chip-label">Group ${String.fromCharCode(65 + i)}</span>` +
			`<span class="group-chip-count">${counts[i]}</span>` +
			`</span>`;
	}
	html += `<button id="clear-all-btn">Clear All</button>`;
	groupLegend.innerHTML = html;
};

// Use event delegation so a single listener handles the "Clear All" button
// regardless of how many times the legend HTML is rebuilt.
groupLegend.addEventListener("click", (e) => {
	if (e.target.closest("#clear-all-btn")) {
		e.stopPropagation();
		clearAll();
	}
});

/** Returns a random group index in [0, groupCount). */
const pickRandomGroup = () => Math.floor(Math.random() * groupCount);

// ----- Single-mode colour helper -----
const pickUnusedColor = () => {
	const alreadyChosenColors = Array.from(players.values()).map(
		(p) => p.color
	);
	let c = 0;
	while (alreadyChosenColors.includes(c)) {
		c++;
	}
	return c;
};

// ----- Player lifecycle -----
const addPlayer = (id, x, y) => {
	if (currentMode === MODE_GROUP) {
		// In group mode the player is added as pending (no group yet).
		// Groups are assigned after a short wait – see assignGroups().
		players.set(id, { x, y, color: undefined, groupIndex: undefined });
	} else {
		const c = pickUnusedColor();
		players.set(id, { x, y, color: c });
	}
	draw();
	updateGroupLegend();
	ariaLiveLog(`Player ${id} added`);
};

const updatePlayer = (id, x, y) => {
	const player = players.get(id);
	if (player) {
		player.x = x;
		player.y = y;
		draw();
	}
};

const removePlayer = (id) => {
	players.delete(id);
	draw();
	updateGroupLegend();
	ariaLiveLog(`Player ${id} removed`);
};

// ----- Choose / reset (single mode only) -----
const choosePlayer = (function () {
	const choosePlayer = () => {
		if (players.size < MIN_PLAYERS) return;

		const choosen = Math.floor(Math.random() * players.size);
		chosenPlayer = Array.from(players.keys())[choosen];

		const player = players.get(chosenPlayer);
		chosenPlayerAnimation.startTime = Date.now();
		chosenPlayerAnimation.startValue = Math.max(
			player.x,
			canvas.width - player.x,
			player.y,
			canvas.height - player.y
		);

		draw();

		ariaLiveLog(`Player ${chosenPlayer} chosen`);
	};

	let timeout;
	return () => {
		window.clearTimeout(timeout);
		if (chosenPlayer === undefined && players.size >= MIN_PLAYERS) {
			timeout = window.setTimeout(choosePlayer, CHOOSE_DELAY_MS);
		}
	};
})();

// ----- Assign groups (group mode) -----
/**
 * Schedules group assignment for all pending players.
 * Works like choosePlayer() in single mode: every call cancels the previous
 * timer and starts a new one.  After CHOOSE_DELAY_MS, all players whose
 * groupIndex is still undefined are each assigned a random group and given
 * the corresponding group colour.
 */
const assignGroups = (function () {
	const doAssign = () => {
		let anyAssigned = false;
		for (const player of players.values()) {
			if (player.groupIndex === undefined) {
				const g = pickRandomGroup();
				player.groupIndex = g;
				player.color = g;
				anyAssigned = true;
			}
		}
		if (anyAssigned) {
			draw();
			updateGroupLegend();
			ariaLiveLog("Groups assigned");
		}
	};

	const hasPending = () =>
		Array.from(players.values()).some((p) => p.groupIndex === undefined);

	let timeout;
	return () => {
		window.clearTimeout(timeout);
		if (currentMode === MODE_GROUP && hasPending()) {
			timeout = window.setTimeout(doAssign, CHOOSE_DELAY_MS);
		}
	};
})();

const reset = (function () {
	const reset = () => {
		chosenPlayer = undefined;
		players.clear();
		ariaLiveReset();
		draw();
		updateGroupLegend();
	};

	let timeout;
	return () => {
		window.clearTimeout(timeout);
		timeout = window.setTimeout(reset, RESET_DELAY_MS);
	};
})();

// ----- Pointer event handlers -----
document.addEventListener("pointerdown", (e) => {
	// Ignore touches that land on UI control elements so they don't add players
	if (e.target.closest("#mode-bar, #group-legend")) return;
	addPlayer(e.pointerId, e.clientX, e.clientY);
	if (currentMode === MODE_SINGLE) {
		choosePlayer();
	} else if (currentMode === MODE_GROUP) {
		assignGroups();
	}
});

document.addEventListener("pointermove", (e) => {
	updatePlayer(e.pointerId, e.clientX, e.clientY);
});

const onPointerRemove = (e) => {
	// Only act on pointers that were registered as game players
	if (!players.has(e.pointerId)) return;

	if (currentMode === MODE_SINGLE && chosenPlayer === e.pointerId) {
		reset();
	} else {
		removePlayer(e.pointerId);
		if (currentMode === MODE_SINGLE) {
			choosePlayer();
		} else if (currentMode === MODE_GROUP) {
			assignGroups();
		}
	}
};
document.addEventListener("pointerup", onPointerRemove);
document.addEventListener("pointercancel", onPointerRemove);

// Prevent page from scrolling.
// Chrome on Android immediately cancels pointer events if the page starts to
// scroll up or down. Because of Chrome's hiding url bar, the page does actually
// scroll, even though the page content is not enough to cause scroll bars.
// Calling preventDefault on all touchmove events helps here, but feels like a
// hack. Would be nice to find a better solution.
document.addEventListener(
	"touchmove",
	(e) => {
		e.preventDefault();
	},
	{ passive: false }
);

// ----- Mode switching -----
/**
 * Shows or hides the group-specific UI panels (controls + legend)
 * and updates the mode button active state and description text.
 */
const applyMode = (newMode) => {
	currentMode = newMode;
	const isGroup = currentMode === MODE_GROUP;

	// Update segmented control appearance
	modeBtns.forEach((b) =>
		b.classList.toggle("active", b.dataset.mode === newMode)
	);

	// Toggle group-specific panels using display style so CSS flex layout is respected
	groupControls.hidden = !isGroup;
	groupLegend.hidden = !isGroup;

	// Update instruction text to match the active mode
	if (isGroup) {
		description.textContent =
			`Group mode: put fingers on the screen and after ${CHOOSE_DELAY_MS / 1000} seconds they will be assigned to groups. ` +
			"Configure the number of groups using the controls above.";
		updateGroupLegend();
	} else {
		description.textContent =
			"Make all players put one finger on the screen. After 2 seconds one player is chosen at random.";
	}
};

modeBtns.forEach((btn) => {
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const newMode = btn.dataset.mode;
		if (newMode === currentMode) return;
		// Clear all players when switching modes to avoid confusion
		clearAll();
		applyMode(newMode);
	});
});

// ----- Group count controls -----
/** Updates the count label and disables ± buttons at the limits. */
const updateGroupCountDisplay = () => {
	groupCountLabel.textContent = `${groupCount} groups`;
	groupDecBtn.disabled = groupCount <= MIN_GROUPS;
	groupIncBtn.disabled = groupCount >= MAX_GROUPS;
};

groupDecBtn.addEventListener("click", (e) => {
	e.stopPropagation();
	if (groupCount > MIN_GROUPS) {
		groupCount--;
		updateGroupCountDisplay();
		clearAll(); // reset players when group count changes to avoid orphaned assignments
	}
});

groupIncBtn.addEventListener("click", (e) => {
	e.stopPropagation();
	if (groupCount < MAX_GROUPS) {
		groupCount++;
		updateGroupCountDisplay();
		clearAll();
	}
});

// Initialise group count display on load
updateGroupCountDisplay();

// ----- Service Worker -----
if ("serviceWorker" in navigator && location.hostname !== "localhost") {
	window.addEventListener("load", () => {
		// Use a relative path so registration works both at root and at /chooser/ on GitHub Pages
		navigator.serviceWorker.register("./sw.js").catch((err) => {
			console.warn("ServiceWorker registration failed: ", err);
		});
	});
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		updateAvailable.hidden = false;
	});
	navigator.serviceWorker.addEventListener("message", (e) => {
		if (e.data.version) {
			version.textContent = e.data.version;
		}
	});
	navigator.serviceWorker.ready.then((sw) => {
		sw.active.postMessage("version");
	});
}
