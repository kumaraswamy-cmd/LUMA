// State Management
const state = {
    tasks: (() => {
        try {
            return JSON.parse(localStorage.getItem("taskly_tasks")) || [];
        } catch(e) {
            return [];
        }
    })(),
    streak: parseInt(localStorage.getItem("taskly_streak")) || 0,
    streakGoal: parseInt(localStorage.getItem("taskly_streak_goal")) || 7,
    theme: localStorage.getItem("taskly_theme") || "mist",
    timer: {
        totalSeconds: 15 * 60,
        remainingSeconds: 15 * 60,
        intervalId: null,
        isRunning: false
    },
    audio: {
        ctx: null,
        sources: {},
        activeTrack: null
    }
};

function saveLocalStorageState() {
    localStorage.setItem("taskly_tasks", JSON.stringify(state.tasks));
    localStorage.setItem("taskly_streak", state.streak);
    localStorage.setItem("taskly_streak_goal", state.streakGoal);
    localStorage.setItem("taskly_theme", state.theme);
}

// SVG Progress constants
const TIMER_CIRCUMFERENCE = 628; // 2 * PI * 100

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initThemeSelector();
    initMascotTracking();
    initTasks();
    initFocusTimer();
    initAIChat();
    initGoogleLogin();
    
    // Initial renders
    renderTasks();
    updateHeaderStats();
    updateStatsPage();
    
    // Collapsible blocks
    document.querySelectorAll(".block-header").forEach(header => {
        header.addEventListener("click", () => {
            const card = header.closest(".block-card");
            card.classList.toggle("collapsed");
            const arrow = header.querySelector(".arrow");
            if(card.classList.contains("collapsed")) {
                arrow.textContent = "▲";
            } else {
                arrow.textContent = "▼";
            }
        });
    });

    // Onboarding close banner
    document.getElementById("close-banner-btn").addEventListener("click", () => {
        document.getElementById("onboarding-banner").classList.add("closed");
    });
});

// Routing / View switcher
function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const views = document.querySelectorAll(".view");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetId = item.getAttribute("data-target");
            
            navItems.forEach(n => n.classList.remove("active"));
            views.forEach(v => v.classList.remove("active"));
            
            item.classList.add("active");
            document.getElementById(targetId).classList.add("active");
        });
    });

    // Header Quick Add plus button links to priorities page
    document.getElementById("header-add-btn").addEventListener("click", () => {
        document.querySelector('[data-target="todo-view"]').click();
        document.getElementById("global-todo-input").focus();
    });

    // Header User Avatar click links to Stats page
    const avatarBubble = document.getElementById("user-avatar-bubble");
    if (avatarBubble) {
        avatarBubble.addEventListener("click", () => {
            document.querySelector('[data-target="stats-view"]').click();
        });
    }
}

// State helpers
function updateHeaderStats() {
    const completedCount = state.tasks.filter(t => t.completed).length;
    document.getElementById("header-completed-count").textContent = completedCount;
    document.getElementById("header-streak-count").textContent = state.streak;
}

// Tasks engine
function initTasks() {
    // Listeners for block-specific task quick-adds
    document.querySelectorAll(".quick-input-row").forEach(row => {
        const input = row.querySelector("input");
        const btn = row.querySelector(".quick-add-btn");
        
        const addTask = () => {
            const text = input.value.trim();
            if(!text) return;
            
            const block = input.getAttribute("data-block");
            const priority = input.getAttribute("data-priority");
            
            const newTask = {
                id: Date.now(),
                text: text,
                completed: false,
                block: block || "anytime",
                priority: priority || "todo"
            };
            
            state.tasks.push(newTask);
            input.value = "";
            saveLocalStorageState();
            renderTasks();
            updateHeaderStats();
            updateStatsPage();
        };

        input.addEventListener("keydown", (e) => {
            if(e.key === "Enter") addTask();
        });
        btn.addEventListener("click", addTask);
    });

    // Global To-Do input (bottom of Priority page)
    const globalInput = document.getElementById("global-todo-input");
    const globalBtn = document.getElementById("global-todo-add-btn");
    
    const addGlobalTask = () => {
        const text = globalInput.value.trim();
        if(!text) return;
        
        state.tasks.push({
            id: Date.now(),
            text: text,
            completed: false,
            block: "anytime",
            priority: "todo"
        });
        
        globalInput.value = "";
        saveLocalStorageState();
        renderTasks();
        updateHeaderStats();
        updateStatsPage();
    };

    globalInput.addEventListener("keydown", (e) => {
        if(e.key === "Enter") addGlobalTask();
    });
    globalBtn.addEventListener("click", addGlobalTask);
}

function renderTasks() {
    // Lists to populate
    const lists = {
        // Blocks
        anytime: document.getElementById("list-anytime"),
        morning: document.getElementById("list-morning"),
        afternoon: document.getElementById("list-afternoon"),
        evening: document.getElementById("list-evening"),
        // Priorities
        high: document.getElementById("list-high"),
        medium: document.getElementById("list-medium"),
        low: document.getElementById("list-low"),
        general: document.getElementById("list-general")
    };

    // Clear lists
    Object.values(lists).forEach(list => {
        if(list) list.innerHTML = "";
    });

    // Counts mapping
    const counts = {
        anytime: 0, morning: 0, afternoon: 0, evening: 0,
        high: 0, medium: 0, low: 0, general: 0
    };

    // Populate task HTML elements
    state.tasks.forEach(task => {
        // Create HTML element
        const taskEl = document.createElement("div");
        taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
        taskEl.innerHTML = `
            <div class="task-item-left">
                <div class="checkbox-round ${task.completed ? 'checked' : ''}"></div>
                <span class="task-text">${task.text}</span>
            </div>
            <button class="delete-task-btn">&times;</button>
        `;

        // Toggle task completion
        const cb = taskEl.querySelector(".checkbox-round");
        cb.addEventListener("click", (e) => {
            e.stopPropagation();
            task.completed = !task.completed;
            if(task.completed) {
                // If checking a task, increase completion score and check streak
                const totalCompleted = state.tasks.filter(t => t.completed).length;
                if(totalCompleted % 5 === 0) {
                    state.streak += 1;
                }
            }
            saveLocalStorageState();
            renderTasks();
            updateHeaderStats();
            updateStatsPage();
        });

        // Delete task
        const delBtn = taskEl.querySelector(".delete-task-btn");
        delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            state.tasks = state.tasks.filter(t => t.id !== task.id);
            saveLocalStorageState();
            renderTasks();
            updateHeaderStats();
            updateStatsPage();
        });

        // Append to block-list
        if(lists[task.block]) {
            lists[task.block].appendChild(taskEl.cloneNode(true));
            counts[task.block]++;
        }

        // Append to priority-list
        const targetPriority = (task.priority === "todo") ? "general" : task.priority;
        if(lists[targetPriority]) {
            // Re-setup checkbox triggers for clone elements
            const priorityClone = taskEl.cloneNode(true);
            const cloneCb = priorityClone.querySelector(".checkbox-round");
            cloneCb.addEventListener("click", (e) => {
                e.stopPropagation();
                task.completed = !task.completed;
                saveLocalStorageState();
                renderTasks();
                updateHeaderStats();
                updateStatsPage();
            });
            const cloneDel = priorityClone.querySelector(".delete-task-btn");
            cloneDel.addEventListener("click", (e) => {
                e.stopPropagation();
                state.tasks = state.tasks.filter(t => t.id !== task.id);
                saveLocalStorageState();
                renderTasks();
                updateHeaderStats();
                updateStatsPage();
            });

            lists[targetPriority].appendChild(priorityClone);
            counts[targetPriority]++;
        }
    });

    // Check for empty states and inject indicators
    Object.entries(lists).forEach(([key, container]) => {
        if (container && container.children.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.className = "empty-state";
            
            // Customize empty message by block/priority
            let msg = "No tasks scheduled";
            if (key === "high") msg = "No high priority tasks";
            else if (key === "medium") msg = "No medium priority tasks";
            else if (key === "low") msg = "No low priority tasks";
            else if (key === "general") msg = "All caught up!";
            else if (key === "morning") msg = "Morning is clear";
            else if (key === "afternoon") msg = "Afternoon is clear";
            else if (key === "evening") msg = "Evening is clear";
            
            emptyEl.textContent = msg;
            container.appendChild(emptyEl);
        }
    });

    // Update Section Badge counter numbers
    document.querySelectorAll(".block-card").forEach(card => {
        const badgeSpan = card.querySelector(".block-badge .count");
        if(badgeSpan) {
            const badgeType = badgeSpan.closest(".block-badge").classList[1].split("-")[1];
            if(counts[badgeType] !== undefined) {
                badgeSpan.textContent = counts[badgeType];
            }
        }
    });
}

// Character eye tracking mouse interaction
function initMascotTracking() {
    document.addEventListener("mousemove", (event) => {
        const eyes = document.querySelectorAll(".mascot-pupil");
        eyes.forEach(pupil => {
            const eyeRect = pupil.parentElement.getBoundingClientRect();
            const eyeCenterX = eyeRect.left + eyeRect.width / 2;
            const eyeCenterY = eyeRect.top + eyeRect.height / 2;

            const angle = Math.atan2(event.clientY - eyeCenterY, event.clientX - eyeCenterX);
            const distance = Math.min(3, Math.hypot(event.clientX - eyeCenterX, event.clientY - eyeCenterY) / 30);
            
            const transX = Math.cos(angle) * distance;
            const transY = Math.sin(angle) * distance;
            
            pupil.style.transform = `translate(${transX}px, ${transY}px)`;
        });
    });
}

// Stats & Themes configuration page
function initThemeSelector() {
    const groups = document.querySelectorAll(".theme-sphere-group");
    
    // Apply startup theme or saved theme
    const applyTheme = (themeName) => {
        document.documentElement.setAttribute("data-theme", themeName);
        state.theme = themeName;
        saveLocalStorageState();

        groups.forEach(g => {
            if (g.getAttribute("data-theme-name") === themeName) {
                g.classList.add("active");
            } else {
                g.classList.remove("active");
            }
        });

        // Dynamically update mobile browser toolbar/status bar color for seamless PWA integration
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            let barColor = "#F5F4F0";
            if (themeName === "sunset") barColor = "#FAF2EB";
            else if (themeName === "aurora") barColor = "#F2FAF6";
            else if (themeName === "cosmic") barColor = "#0A0A10";
            metaTheme.setAttribute("content", barColor);
        }
    };

    // Apply active theme
    applyTheme(state.theme);

    groups.forEach(group => {
        group.addEventListener("click", () => {
            const themeName = group.getAttribute("data-theme-name");
            applyTheme(themeName);
        });
    });
}

function updateStatsPage() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;

    // Completed tasks elements
    document.getElementById("stats-completed-count").textContent = completed;
    document.getElementById("completed-desc-text").textContent = `${completed}/${total} tasks`;
    const completedPct = total > 0 ? (completed / total) * 100 : 0;
    document.getElementById("completed-bar-progress").style.width = `${completedPct}%`;

    // Streak tracker elements
    document.getElementById("stats-streak-count").textContent = state.streak;
    document.getElementById("streak-desc-text").textContent = `${state.streak}/${state.streakGoal} days`;
    const streakPct = (state.streak / state.streakGoal) * 100;
    document.getElementById("streak-bar-progress").style.width = `${Math.min(streakPct, 100)}%`;

    // Completion Rate Card updates
    const pctText = document.getElementById("completion-pct-value");
    const pctFill = document.getElementById("completion-rate-fill");
    const msgText = document.getElementById("total-completed-message-text");

    if (pctText) pctText.textContent = `${Math.round(completedPct)}%`;
    if (pctFill) pctFill.style.width = `${completedPct}%`;
    if (msgText) msgText.textContent = `You've completed ${completed} tasks so far`;
}

// Web Audio Ambient Synthesizer
function getAudioContext() {
    if (!state.audio.ctx) {
        state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audio.ctx.state === 'suspended') {
        state.audio.ctx.resume();
    }
    return state.audio.ctx;
}

// Custom Synths for focus tracks
function playSyntheticSound(trackType) {
    const ctx = getAudioContext();
    stopSyntheticSound(); // Stop previous active tracks

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const trackNodes = [];

    if (trackType === 'rain') {
        // Brown noise + Bandpass filter modulation for soft wind/rain sound
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            // Filter white noise to brown
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; // Gain compensation
        }
        
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const rainFilter = ctx.createBiquadFilter();
        rainFilter.type = 'lowpass';
        rainFilter.frequency.setValueAtTime(600, ctx.currentTime);

        noiseSource.connect(rainFilter);
        rainFilter.connect(masterGain);
        noiseSource.start();

        trackNodes.push(noiseSource);

    } else if (trackType === 'lofi') {
        // Slow pulsing chill chord synthesizers using triangle oscillators
        const playLofiChord = () => {
            const now = ctx.currentTime;
            const freqs = [196.00, 246.94, 293.66, 392.00]; // G maj7 chord
            const oscillators = [];

            freqs.forEach(freq => {
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);

                const oscGain = ctx.createGain();
                oscGain.gain.setValueAtTime(0, now);
                oscGain.gain.linearRampToValueAtTime(0.04, now + 1.5);
                oscGain.gain.exponentialRampToValueAtTime(0.001, now + 5.0);

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, now);

                osc.connect(oscGain);
                oscGain.connect(filter);
                filter.connect(masterGain);

                osc.start(now);
                osc.stop(now + 6);
                oscillators.push(osc);
            });
        };

        // Trigger loop every 6 seconds
        playLofiChord();
        const lofiInterval = setInterval(playLofiChord, 6000);
        
        // Mock control structure to clear intervals
        trackNodes.push({
            stop: () => {
                clearInterval(lofiInterval);
            }
        });

    } else if (trackType === 'forest') {
        // Chirping sinewave oscillators for birds / forest hum
        const noiseSource = ctx.createOscillator();
        noiseSource.type = 'sine';
        noiseSource.frequency.setValueAtTime(120, ctx.currentTime);

        const mod = ctx.createOscillator();
        mod.type = 'sine';
        mod.frequency.setValueAtTime(2.5, ctx.currentTime);

        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(15, ctx.currentTime);

        mod.connect(modGain);
        modGain.connect(noiseSource.frequency);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, ctx.currentTime);

        noiseSource.connect(filter);
        filter.connect(masterGain);

        mod.start();
        noiseSource.start();

        trackNodes.push(mod, noiseSource);
    }

    state.audio.sources[trackType] = {
        nodes: trackNodes,
        gain: masterGain
    };
    state.audio.activeTrack = trackType;
}

function stopSyntheticSound() {
    if (state.audio.activeTrack) {
        const active = state.audio.sources[state.audio.activeTrack];
        if (active && active.nodes) {
            active.nodes.forEach(node => {
                try { node.stop(); } catch(e) {}
            });
        }
        state.audio.activeTrack = null;
    }
}

// Focus Timer Widget
function initFocusTimer() {
    const playBtn = document.getElementById("timer-play-btn");
    const playIcon = document.getElementById("play-btn-icon");
    const playText = document.getElementById("play-btn-text");
    const minutesText = document.getElementById("timer-minutes-text");
    const progressBar = document.getElementById("timer-progress-bar");
    const statusText = document.querySelector(".timer-status-text");

    // Click presets pills below timer
    document.querySelectorAll(".preset-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            if(state.timer.isRunning) return;
            
            document.querySelectorAll(".preset-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            
            const mins = parseInt(pill.getAttribute("data-mins"));
            state.timer.totalSeconds = mins * 60;
            state.timer.remainingSeconds = mins * 60;
            if(statusText) statusText.textContent = "--";
            updateTimerDisplay();
        });
    });

    // Play button toggle
    playBtn.addEventListener("click", () => {
        if(state.timer.isRunning) {
            // Pause
            clearInterval(state.timer.intervalId);
            state.timer.isRunning = false;
            playBtn.classList.remove("running");
            playIcon.textContent = "▶";
            playText.textContent = "Start";
            if(statusText) statusText.textContent = "Paused";
        } else {
            // Resume/Start
            state.timer.isRunning = true;
            playBtn.classList.add("running");
            playIcon.textContent = "⏸";
            playText.textContent = "Pause";
            if(statusText) statusText.textContent = "Focus Session Active";

            state.timer.intervalId = setInterval(() => {
                state.timer.remainingSeconds--;
                updateTimerDisplay();

                if(state.timer.remainingSeconds <= 0) {
                    // Timer Finished
                    clearInterval(state.timer.intervalId);
                    state.timer.isRunning = false;
                    playBtn.classList.remove("running");
                    playIcon.textContent = "▶";
                    playText.textContent = "Start";
                    state.streak += 1;
                    saveLocalStorageState();
                    updateHeaderStats();
                    updateStatsPage();
                    if(statusText) statusText.textContent = "Session Complete!";
                    alert("Focus session complete! Streak increased! 🚀");
                    state.timer.remainingSeconds = state.timer.totalSeconds;
                    updateTimerDisplay();
                }
            }, 1000);
        }
    });

    // Drawer toggler
    document.getElementById("tune-in-btn").addEventListener("click", () => {
        const drawer = document.getElementById("sound-drawer");
        drawer.style.display = drawer.style.display === "none" ? "block" : "none";
    });

    // Track selections
    document.querySelectorAll(".track-row").forEach(row => {
        const playBtn = row.querySelector(".track-play-btn");
        row.addEventListener("click", () => {
            const trackType = row.getAttribute("data-track");
            
            if(row.classList.contains("playing")) {
                // Pause it
                stopSyntheticSound();
                row.classList.remove("playing");
                playBtn.textContent = "▶";
            } else {
                // Play it
                document.querySelectorAll(".track-row").forEach(r => {
                    r.classList.remove("playing");
                    r.querySelector(".track-play-btn").textContent = "▶";
                });
                playSyntheticSound(trackType);
                row.classList.add("playing");
                playBtn.textContent = "⏸";
            }
        });
    });

    function updateTimerDisplay() {
        const mins = Math.ceil(state.timer.remainingSeconds / 60);
        minutesText.textContent = mins;
        
        // Progress ring dash calculation
        const percent = state.timer.remainingSeconds / state.timer.totalSeconds;
        const offset = TIMER_CIRCUMFERENCE - (percent * TIMER_CIRCUMFERENCE);
        progressBar.style.strokeDashoffset = offset;
    }

    // Init display
    updateTimerDisplay();
}

// AI Chatbot Assistant (Thought Catcher parsing engine)
function initAIChat() {
    const input = document.getElementById("chat-input-field");
    const sendBtn = document.getElementById("chat-send-trigger");
    const voiceBtn = document.getElementById("voice-speak-btn");
    const scroller = document.getElementById("chat-scroller");
    const welcome = document.getElementById("chat-welcome-box");
    const history = document.getElementById("chat-history-log");

    const sendUserMessage = () => {
        const text = input.value.trim();
        if(!text) return;

        welcome.style.display = "none";
        history.classList.add("active");

        // User bubble
        appendChatBubble(text, "user");
        input.value = "";

        // Mascot analyzing reply
        setTimeout(() => {
            const aiResponse = parseAndCreateTasks(text);
            appendChatBubble(aiResponse, "ai");
            renderTasks();
            updateHeaderStats();
            updateStatsPage();
        }, 1200);
    };

    sendBtn.addEventListener("click", sendUserMessage);
    input.addEventListener("keydown", (e) => {
        if(e.key === "Enter") sendUserMessage();
    });

    // Voice trigger mockup
    voiceBtn.addEventListener("click", () => {
        voiceBtn.textContent = "🎙️ Listening...";
        voiceBtn.style.background = "var(--text-muted)";
        
        setTimeout(() => {
            voiceBtn.textContent = "🎙️ Speak";
            voiceBtn.style.background = "#1C1B1F";
            input.value = "Need to review design specs in afternoon and code high priority";
            sendUserMessage();
        }, 2200);
    });

    function appendChatBubble(text, sender) {
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${sender}`;
        bubble.textContent = text;
        history.appendChild(bubble);
        scroller.scrollTop = scroller.scrollHeight;
    }

    // Local natural language parser
    function parseAndCreateTasks(inputStr) {
        const str = inputStr.toLowerCase();
        let targetBlock = "anytime";
        let targetPriority = "todo";
        
        // Find time block
        if(str.includes("morning") || str.includes("early")) targetBlock = "morning";
        else if(str.includes("afternoon") || str.includes("lunch")) targetBlock = "afternoon";
        else if(str.includes("evening") || str.includes("night") || str.includes("dinner")) targetBlock = "evening";

        // Find priority
        if(str.includes("high") || str.includes("urgent") || str.includes("critical")) targetPriority = "high";
        else if(str.includes("medium") || str.includes("normal") || str.includes("next")) targetPriority = "medium";
        else if(str.includes("low") || str.includes("later")) targetPriority = "low";

        // Extract description
        let cleanText = inputStr.replace(/morning|afternoon|evening|night|anytime|high|medium|low|urgent|critical|normal/gi, "").trim();
        // Remove trailing connector words
        cleanText = cleanText.replace(/^(and|need to|want to|schedule|to|in the|on)\s+/i, "");
        cleanText = cleanText.replace(/\s+(and|priority|in the)$/i, "");
        
        if(cleanText.length < 2) {
            cleanText = "New scheduled task";
        }

        // Capitalize first letter
        cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

        // Save task
        state.tasks.push({
            id: Date.now(),
            text: cleanText,
            completed: false,
            block: targetBlock,
            priority: targetPriority
        });
        saveLocalStorageState();

        // AI Response Text
        const greetings = ["Done!", "Got it!", "Alright!", "Scheduled!"];
        const greet = greetings[Math.floor(Math.random() * greetings.length)];
        
        return `${greet} I've added "${cleanText}" under your ${targetBlock.toUpperCase()} block and assigned it ${targetPriority.toUpperCase()} priority. ✨`;
    }
}

// Google Login real OAuth handler
function initGoogleLogin() {
    const loginScreen = document.getElementById("login-screen");
    const configToggle = document.getElementById("config-toggle-btn");
    const configContent = document.getElementById("config-content");
    const clientIdInput = document.getElementById("custom-client-id-input");
    const saveClientIdBtn = document.getElementById("save-client-id-btn");

    // Drawer toggle
    configToggle.addEventListener("click", () => {
        configContent.style.display = configContent.style.display === "none" ? "block" : "none";
    });

    // Check localStorage for prior login state
    const savedUser = localStorage.getItem("luma_logged_in");
    const savedPic = localStorage.getItem("luma_profile_pic");
    const savedEmail = localStorage.getItem("luma_email");
    
    if (savedUser) {
        loginScreen.classList.add("hidden");
        updateProfileName(savedUser, savedPic, savedEmail);
    }

    // Default development client ID (replaceable by user in UI)
    let clientId = localStorage.getItem("luma_client_id") || "72491820587-testdummyclient.apps.googleusercontent.com";
    clientIdInput.value = clientId;

    const setupGoogleGSI = () => {
        if (typeof google === 'undefined' || !google.accounts) {
            // Retry loading GSI client SDK after a small delay
            setTimeout(setupGoogleGSI, 500);
            return;
        }
        
        try {
            google.accounts.id.initialize({
                client_id: clientId,
                callback: handleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: true
            });

            // Render Google official button in container
            google.accounts.id.renderButton(
                document.getElementById("google-signin-button-container"),
                {
                    theme: "outline",
                    size: "large",
                    shape: "pill",
                    width: 280,
                    text: "signin_with",
                    logo_alignment: "left"
                }
            );

            // Trigger Google One Tap overlay
            google.accounts.id.prompt();
        } catch (e) {
            console.error("Google GSI Initialization Error:", e);
        }
    };

    // Initialize GIS button
    setupGoogleGSI();

    // Re-initialize button if custom client ID saved
    saveClientIdBtn.addEventListener("click", () => {
        const customId = clientIdInput.value.trim();
        if (customId) {
            localStorage.setItem("luma_client_id", customId);
            clientId = customId;
            setupGoogleGSI();
            alert("Google Client ID configured! Re-rendering sign-in button...");
        }
    });

    // Bind real sign-out button
    const signoutBtn = document.getElementById("profile-signout-btn");
    if (signoutBtn) {
        signoutBtn.addEventListener("click", () => {
            localStorage.removeItem("luma_logged_in");
            localStorage.removeItem("luma_profile_pic");
            localStorage.removeItem("luma_email");
            
            // Show login screen
            loginScreen.classList.remove("hidden");
            
            // Reset UI credentials
            updateProfileName("Guest User", "", "Not signed in");
            
            if (typeof google !== 'undefined' && google.accounts) {
                google.accounts.id.disableAutoSelect();
            }
        });
    }

    // Parse the JWT token payload
    function handleCredentialResponse(response) {
        try {
            const credentialToken = response.credential;
            const profile = decodeJwt(credentialToken);
            
            if (profile && profile.name) {
                localStorage.setItem("luma_logged_in", profile.name);
                if (profile.picture) localStorage.setItem("luma_profile_pic", profile.picture);
                if (profile.email) localStorage.setItem("luma_email", profile.email);
                
                // Hide login screen
                loginScreen.classList.add("hidden");
                updateProfileName(profile.name, profile.picture, profile.email);
            }
        } catch (error) {
            console.error("Failed to login with Google:", error);
            alert("Authentication failed. Please verify your Client ID config.");
        }
    }

    // Helper to decode JWT without external dependencies
    function decodeJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("JWT Decode error:", e);
            return null;
        }
    }
}

function updateProfileName(name, avatarUrl, email) {
    const profileHeader = document.querySelector("#stats-view h1");
    if (profileHeader) {
        profileHeader.textContent = "Your Progress";
    }
    
    // Header date personalization
    const welcomeTitle = document.getElementById("daily-day-title");
    if (welcomeTitle) {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        welcomeTitle.textContent = `${today}`;
    }

    // Update Avatar image bubble in header if available
    const avatarBubble = document.getElementById("user-avatar-bubble");
    if (avatarBubble) {
        if (avatarUrl) {
            avatarBubble.style.backgroundImage = `url('${avatarUrl}')`;
            avatarBubble.style.display = "block";
        } else {
            avatarBubble.style.backgroundImage = "none";
            avatarBubble.style.display = "none";
        }
    }

    // Update profile card elements
    const cardName = document.getElementById("profile-card-name");
    const cardEmail = document.getElementById("profile-card-email");
    const cardAvatar = document.getElementById("profile-card-avatar");

    if (cardName) cardName.textContent = name || "Guest User";
    if (cardEmail) cardEmail.textContent = email || "Not signed in";
    if (cardAvatar) {
        if (avatarUrl) {
            cardAvatar.style.backgroundImage = `url('${avatarUrl}')`;
        } else {
            cardAvatar.style.backgroundImage = "none";
        }
    }
}
