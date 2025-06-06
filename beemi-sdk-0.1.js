/* event bus */
const listeners = {};

export function on(type, cb) { 
  (listeners[type] ||= []).push(cb); 
}

export function emit(type, data) { 
  (listeners[type] || []).forEach(f => f(data)); 
}

/* utilities the host may listen for */
export const leaderboard = { 
  update: data => emit('__leaderboard__', data) 
};

/* expose globally so RN bridge can call emit() - only in browser environment */
if (typeof window !== 'undefined') {
  window.beemi = { on, emit, leaderboard };
} 