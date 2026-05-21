import type { Config } from "tailwindcss";

/**
 * Tailwind config for Kairo's web app. Emerald/blue cinematic dark palette,
 * glass-card surfaces, status-badge family.
 *
 * Legacy token aliases (text-text, surface-2, line, accent-fg) remain so
 * existing components keep rendering while we migrate to the canonical
 * shadcn tokens (primary, foreground, muted-foreground, etc).
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '1rem',
  		screens: {
  			'2xl': '1280px'
  		}
  	},
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			emerald: {
  				DEFAULT: 'hsl(var(--emerald))',
  				glow: 'hsl(var(--emerald-glow))',
  				muted: 'hsl(var(--emerald-muted))'
  			},
  			'surface-1': 'hsl(var(--surface-1))',
  			'surface-2': 'hsl(var(--surface-2))',
  			'surface-3': 'hsl(var(--surface-3))',
  			bg: 'hsl(var(--background))',
  			surface: 'hsl(var(--surface-1))',
  			text: 'hsl(var(--foreground))',
  			'text-dim': 'hsl(var(--muted-foreground))',
  			line: 'hsl(var(--border))',
  			warn: {
  				DEFAULT: 'hsl(var(--warn))',
  				fg: 'hsl(var(--warn-fg))'
  			},
  			deny: {
  				DEFAULT: 'hsl(var(--deny))',
  				fg: 'hsl(var(--deny-fg))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 4px)',
  			sm: 'calc(var(--radius) - 8px)'
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-sans)'
  			],
  			mono: [
  				'var(--font-mono)'
  			]
  		},
  		backgroundImage: {
  			'gradient-primary': 'var(--gradient-primary)',
  			'gradient-hero': 'var(--gradient-hero)',
  			'gradient-card': 'var(--gradient-card)',
  			'gradient-glow': 'var(--gradient-glow)'
  		},
  		boxShadow: {
  			glow: 'var(--shadow-glow)',
  			'glow-sm': 'var(--shadow-glow-sm)'
  		},
  		keyframes: {
  			'fade-in': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(8px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			},
  			'pulse-glow': {
  				'0%, 100%': {
  					boxShadow: '0 0 20px hsl(162 72% 46% / 0.1)'
  				},
  				'50%': {
  					boxShadow: '0 0 40px hsl(162 72% 46% / 0.2)'
  				}
  			}
  		},
  		animation: {
  			'fade-in': 'fade-in 0.3s ease-out',
  			shimmer: 'shimmer 2s ease-in-out infinite',
  			'pulse-glow': 'pulse-glow 3s ease-in-out infinite'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
