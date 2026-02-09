const colors = {
  TODO_NAME_THIS_COLOR: '#0a1f1a', // Main app background
  TODO_NAME_THIS_COLOR: '#0f251f', // Secondary backgrounds (nav bar, cards)
  TODO_NAME_THIS_COLOR: '#0a0f0d', // Darker backgrounds (food page)
  TODO_NAME_THIS_COLOR: '#141a17', // Card backgrounds
  TODO_NAME_THIS_COLOR: '#1a2520', // Elevated card backgrounds
  TODO_NAME_THIS_COLOR: '#0f2419', // Dark card backgrounds (active states)
  TODO_NAME_THIS_COLOR: '#1a2f2a', // Overlay backgrounds
  TODO_NAME_THIS_COLOR: '#0f2f27', // Filter tab background
  TODO_NAME_THIS_COLOR: '#1a3d35', // Dark icon backgrounds
  TODO_NAME_THIS_COLOR: '#243d37', // Darker icon backgrounds
  TODO_NAME_THIS_COLOR: '#1a2420', // Darkest icon backgrounds
  TODO_NAME_THIS_COLOR: '#16a34a', // Workout action button icon background
  TODO_NAME_THIS_COLOR: '#d4b5a0', // Light image background
  TODO_NAME_THIS_COLOR: '#8b7d6b', // Medium image background
  TODO_NAME_THIS_COLOR: '#1a3d2f', // Notification card gradient start
  TODO_NAME_THIS_COLOR: '#374151', // Gray-700
  TODO_NAME_THIS_COLOR: '#1f2937', // Gray-800
  TODO_NAME_THIS_COLOR: 'rgba(31, 41, 55, 0.5)', // Gray-800/50
  TODO_NAME_THIS_COLOR: '#ffffff', // White background
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.6)', // Black overlay with 60% opacity
  TODO_NAME_THIS_COLOR: '#3d3162', // Purple blob background
  TODO_NAME_THIS_COLOR: '#125630', // Green blob background
  TODO_NAME_THIS_COLOR: 'rgba(25, 43, 35, 0.5)', // Dark green with 50% opacity
  TODO_NAME_THIS_COLOR: 'rgba(27, 50, 39, 0.8)', // Dark green with 80% opacity
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.1)', // Black with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.15)', // Black with 15% opacity
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.2)', // Black with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.3)', // Black with 30% opacity
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.4)', // Black with 40% opacity
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.8)', // Black with 80% opacity
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.9)', // Black with 90% opacity
  TODO_NAME_THIS_COLOR: '#15261f', // Dark green for AI card background
  TODO_NAME_THIS_COLOR: '#1a3a2a', // Dark green variant for tags/badges
  TODO_NAME_THIS_COLOR: 'rgba(26, 46, 42, 0.9)', // Dark green overlay (rgba(26, 46, 42, 0.9))
  TODO_NAME_THIS_COLOR: '#1a2e2a', // Dark green solid color
  TODO_NAME_THIS_COLOR: 'rgba(30, 35, 33, 0.4)', // Dark gray background with opacity
  TODO_NAME_THIS_COLOR: 'rgba(30, 35, 33, 0.5)', // Dark gray with 50% opacity
  TODO_NAME_THIS_COLOR: 'rgba(30, 35, 33, 0.9)', // Dark gray with 90% opacity
  TODO_NAME_THIS_COLOR: 'rgba(17, 20, 19, 0.5)', // Dark gray solid with opacity
  TODO_NAME_THIS_COLOR: 'rgba(42, 50, 46, 1)', // Alternative dark green solid
  TODO_NAME_THIS_COLOR: '#254637', // Exercise card background
  TODO_NAME_THIS_COLOR: '#11211a', // Dark background color (landing page, etc.)
  TODO_NAME_THIS_COLOR: '#0d3520', // Success snackbar background
  TODO_NAME_THIS_COLOR: '#3d1515', // Error snackbar background
  TODO_NAME_THIS_COLOR: '#1a3530', // Button/card background
  TODO_NAME_THIS_COLOR: '#1f4039', // Active button/card background
  TODO_NAME_THIS_COLOR: '#e5e7eb', // Light separator (gray-200)
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.03)', // White with ~3% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.05)', // White with 5% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.1)', // White with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.125)', // White with ~12.5% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.2)', // White with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.3)', // White with 30% opacity
  TODO_NAME_THIS_COLOR: 'rgba(10, 31, 26, 0.2)', // Background primary with 20% opacity
  TODO_NAME_THIS_COLOR: '#ffffff', // Primary text (white)
  TODO_NAME_THIS_COLOR: '#9ca3af', // Secondary text (gray-400)
  TODO_NAME_THIS_COLOR: '#4b5563', // Tertiary text (gray-600)
  TODO_NAME_THIS_COLOR: '#6b7280', // Muted text
  TODO_NAME_THIS_COLOR: '#22c55e', // Accent text (green)
  TODO_NAME_THIS_COLOR: '#34d399', // Light accent text (emerald)
  TODO_NAME_THIS_COLOR: '#000000', // Black text (for icons on light backgrounds)
  TODO_NAME_THIS_COLOR: '#d1d5db', // Gray-300
  TODO_NAME_THIS_COLOR: '#6b7280', // Gray-500
  TODO_NAME_THIS_COLOR: '#ffffff', // White
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.125)', // Primary with 12.5% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.2)', // Primary with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.3)', // Primary with 30% opacity
  TODO_NAME_THIS_COLOR: '#22c55e', // Primary green
  TODO_NAME_THIS_COLOR: '#34d399', // Secondary green (emerald)
  TODO_NAME_THIS_COLOR: '#14b8a6', // Tertiary green (teal)
  TODO_NAME_THIS_COLOR: '#34d399',
  TODO_NAME_THIS_COLOR: '#14b8a6',
  TODO_NAME_THIS_COLOR: 'rgba(34, 197, 94, 0.1)', // Primary with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(34, 197, 94, 0.3)', // Primary with 30% opacity
  TODO_NAME_THIS_COLOR: 'rgba(34, 197, 94, 0.2)', // Primary with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(34, 197, 94, 0.4)', // Primary with 40% opacity
  TODO_NAME_THIS_COLOR: 'rgba(34, 197, 94, 0.5)', // Primary with 50% opacity
  TODO_NAME_THIS_COLOR: 'rgba(34, 197, 94, 0.05)', // Primary with 5% opacity
  TODO_NAME_THIS_COLOR: 'rgba(52, 211, 153, 0.1)', // Secondary with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(52, 211, 153, 0.2)', // Secondary with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(52, 211, 153, 0.31)', // Secondary with 31% opacity
  TODO_NAME_THIS_COLOR: 'rgba(75, 85, 99, 0.5)', // gray-800/50
  TODO_NAME_THIS_COLOR: 'rgba(55, 65, 81, 0.3)', // gray-700/30
  TODO_NAME_THIS_COLOR: '#1a2f2a', // Dark border
  TODO_NAME_THIS_COLOR: '#2a4d3f', // Accent border
  TODO_NAME_THIS_COLOR: '#374151', // Dashed border (gray-700)
  TODO_NAME_THIS_COLOR: 'rgba(6, 78, 59, 0.3)', // emerald-900/30
  TODO_NAME_THIS_COLOR: 'rgba(59, 130, 246, 0.4)', // blue-500/40
  TODO_NAME_THIS_COLOR: 'rgba(75, 85, 99, 0.4)', // gray-600/40
  TODO_NAME_THIS_COLOR: '#22c55e',
  TODO_NAME_THIS_COLOR: '#f97316', // Orange
  TODO_NAME_THIS_COLOR: '#ef4444', // Red
  TODO_NAME_THIS_COLOR: '#3b82f6', // Blue
  TODO_NAME_THIS_COLOR: '#a855f7', // Purple
  TODO_NAME_THIS_COLOR: '#ef4444', // Red notification badge (same as error)
  TODO_NAME_THIS_COLOR: '#fbbf24', // Amber-400
  TODO_NAME_THIS_COLOR: '#eab308', // Yellow-500
  TODO_NAME_THIS_COLOR: '#6366f1', // Indigo-500
  TODO_NAME_THIS_COLOR: '#818cf8', // Indigo-400
  TODO_NAME_THIS_COLOR: '#10b981', // Emerald-500
  TODO_NAME_THIS_COLOR: '#29e08e', // Emerald-400
  TODO_NAME_THIS_COLOR: '#1aa869', // Green-600
  TODO_NAME_THIS_COLOR: '#c7d2fe', // Indigo-100
  TODO_NAME_THIS_COLOR: '#a7f3d0', // Emerald-200
  // Status colors with opacity
  TODO_NAME_THIS_COLOR: 'rgba(34, 197, 94, 0.2)', // Success with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(239, 68, 68, 0.08)', // Error with 8% opacity
  TODO_NAME_THIS_COLOR: 'rgba(239, 68, 68, 0.1)', // Error with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(239, 68, 68, 0.125)', // Error with 12.5% opacity
  TODO_NAME_THIS_COLOR: 'rgba(239, 68, 68, 0.2)', // Error with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(239, 68, 68, 0.5)', // Error with 50% opacity
  TODO_NAME_THIS_COLOR: 'rgba(59, 130, 246, 0.2)', // Info with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(59, 130, 246, 0.1)', // Info with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(59, 130, 246, 0.5)', // Info with 50% opacity
  TODO_NAME_THIS_COLOR: 'rgba(249, 115, 22, 0.5)', // Warning with 50% opacity
  TODO_NAME_THIS_COLOR: 'rgba(168, 85, 247, 0.4)', // Purple with 40% opacity
  TODO_NAME_THIS_COLOR: 'rgba(168, 85, 247, 0.2)', // Purple with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(168, 85, 247, 0.13)', // Purple with 13% opacity (hex '22')
  TODO_NAME_THIS_COLOR: 'rgba(168, 85, 247, 0.1)', // Purple with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(251, 191, 36, 0.1)', // Amber with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(249, 115, 22, 0.1)', // Warning with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(16, 185, 129, 0.1)', // Emerald with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(16, 185, 129, 0.2)', // Emerald with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(16, 185, 129, 0.3)', // Emerald with 30% opacity
  TODO_NAME_THIS_COLOR: 'rgba(41, 224, 142, 0.1)', // Emerald-400 with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(41, 224, 142, 0.2)', // Emerald-400 with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(234, 179, 8, 0.1)', // Yellow with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(99, 102, 241, 0.1)', // Indigo with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(99, 102, 241, 0.2)', // Indigo with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(79, 70, 229, 0.3)', // Indigo-600 with 30% opacity
  TODO_NAME_THIS_COLOR: '#4f46e5', // Indigo-600
  // Red border colors for ungroup action
  TODO_NAME_THIS_COLOR: '#7f1d1d', // Dark red border
  // Emerald border colors for group action
  TODO_NAME_THIS_COLOR: '#064e3b', // Dark emerald border
  TODO_NAME_THIS_COLOR: '#5b21b6', // Purple-700 (for indigo gradients)
  TODO_NAME_THIS_COLOR: '#2563eb', // Blue-600
  TODO_NAME_THIS_COLOR: '#ec4899', // Pink-500 (already in macros but adding for convenience)
  TODO_NAME_THIS_COLOR: '#e11d48', // Rose-600
  TODO_NAME_THIS_COLOR: '#95c6b0', // Custom green used in components
  TODO_NAME_THIS_COLOR: '#0d9488', // Teal-600 (for emerald-teal gradient)
  TODO_NAME_THIS_COLOR: 'rgba(107, 114, 128, 0.1)', // Gray with 10% opacity
  // Error colors for ungroup action
  TODO_NAME_THIS_COLOR: '#ef4444', // Solid red for ungroup
  // Success colors for group action
  TODO_NAME_THIS_COLOR: '#10b981', // Solid emerald for group
  // Additional status colors
  TODO_NAME_THIS_COLOR: '#f87171', // Red-400 (for fat icons, etc.)
  TODO_NAME_THIS_COLOR: '#2dd4bf', // Teal-400 (for monounsat fat, etc.)
  TODO_NAME_THIS_COLOR: '#a78bfa', // Purple-400 (for fiber icons, etc.)
  TODO_NAME_THIS_COLOR: '#8b5cf6', // Violet-500 (for polyunsat fat, etc.)
  TODO_NAME_THIS_COLOR: '#da2552', // Rose-700 (darker, less bright)
  TODO_NAME_THIS_COLOR: '#9f1239', // Rose-800 (darker variant)
  // Rose colors with opacity
  TODO_NAME_THIS_COLOR: 'rgba(218, 37, 82, 0.1)', // Rose-brand with 10% opacity
  TODO_NAME_THIS_COLOR: 'rgba(190, 18, 60, 0.2)', // Rose-brand with 20% opacity
  TODO_NAME_THIS_COLOR: '#ec4899', // Pink-500
  TODO_NAME_THIS_COLOR: '#ec4899', // Pink-500
  TODO_NAME_THIS_COLOR: '#f59e0b', // Amber-500
  TODO_NAME_THIS_COLOR: '#f59e0b', // Amber-500
  TODO_NAME_THIS_COLOR: '#10b981', // Emerald-500
  TODO_NAME_THIS_COLOR: '#10b981', // Emerald-500
  TODO_NAME_THIS_COLOR: '#6366f1', // Indigo-500
  TODO_NAME_THIS_COLOR: '#6366f1', // Indigo-500
  TODO_NAME_THIS_COLOR: '#22c55e', // Primary green
  TODO_NAME_THIS_COLOR: '#3b82f6', // Blue-500
  TODO_NAME_THIS_COLOR: '#8b5cf6', // Violet-500
  TODO_NAME_THIS_COLOR: '#ec4899', // Pink-500
  TODO_NAME_THIS_COLOR: '#f97316', // Orange-500
  TODO_NAME_THIS_COLOR: '#14b8a6', // Teal-500
  TODO_NAME_THIS_COLOR: '#eab308', // Yellow-500
  TODO_NAME_THIS_COLOR: '#6366f1', // Indigo-500
  TODO_NAME_THIS_COLOR: 'rgba(34, 197, 94, 0.2)', // emerald/20
  TODO_NAME_THIS_COLOR: 'rgba(59, 130, 246, 0.2)', // blue-500/20
  TODO_NAME_THIS_COLOR: 'rgba(139, 92, 246, 0.2)', // violet-500/20
  TODO_NAME_THIS_COLOR: 'rgba(236, 72, 153, 0.2)', // pink-500/20
  TODO_NAME_THIS_COLOR: 'rgba(249, 115, 22, 0.2)', // orange-500/20
  TODO_NAME_THIS_COLOR: 'rgba(20, 184, 166, 0.2)', // teal-500/20
  TODO_NAME_THIS_COLOR: 'rgba(234, 179, 8, 0.2)', // yellow-500/20
  TODO_NAME_THIS_COLOR: 'rgba(99, 102, 241, 0.2)', // indigo-500/20

  // Google brand colors
  TODO_NAME_THIS_COLOR: '#747775', // Light border for Google button
  TODO_NAME_THIS_COLOR: '#8e918f', // Dark border for Google button
  TODO_NAME_THIS_COLOR: '#131314', // Dark background for Google button
  TODO_NAME_THIS_COLOR: '#1f1f1f', // Light text for Google button
  TODO_NAME_THIS_COLOR: '#e3e3e3', // Dark text for Google button
  TODO_NAME_THIS_COLOR: '#303030', // Dark overlay for Google button
  TODO_NAME_THIS_COLOR: '#e3e3e3', // Light overlay for Google button
  TODO_NAME_THIS_COLOR: '#1f1f1f1f', // Disabled border (light variant)
  TODO_NAME_THIS_COLOR: '#8e918f1f', // Disabled border (dark variant)
  TODO_NAME_THIS_COLOR: '#ffffff61', // Disabled background (light variant)
  TODO_NAME_THIS_COLOR: '#13131461', // Disabled background (dark variant)

  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.6)', // Black with 60% opacity
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.9)', // Black with 90% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.5)', // White with 50% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.6)', // White with 60% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.7)', // White with 70% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.9)', // White with 90% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.8)', // White with 80% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.3)', // White with 30% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.2)', // White with 20% opacity
  TODO_NAME_THIS_COLOR: 'rgba(255, 255, 255, 0.05)', // White with 5% opacity
  TODO_NAME_THIS_COLOR: 'rgba(0, 0, 0, 0.6)', // Black with 60% opacity (for gradients)
  TODO_NAME_THIS_COLOR: 'rgba(10, 31, 26, 0.8)', // Background primary with 80% opacity (for modals)
  TODO_NAME_THIS_COLOR: 'rgba(10, 31, 26, 0.9)', // Background primary with 90% opacity
  TODO_NAME_THIS_COLOR: 'rgba(26, 46, 42, 0.9)', // Dark green overlay gradient
};
