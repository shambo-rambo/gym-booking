<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "primary-fixed-dim": "#b9c9d3",
              "error": "#ba1a1a",
              "surface-bright": "#f8f9fa",
              "on-primary-fixed-variant": "#3a4951",
              "surface-container-low": "#f3f4f5",
              "primary": "#192830",
              "secondary-container": "#fddab2",
              "surface-container-lowest": "#ffffff",
              "on-tertiary-container": "#b4a58a",
              "primary-fixed": "#d5e5ef",
              "on-secondary-fixed-variant": "#594325",
              "tertiary-fixed": "#f1e0c3",
              "surface-container": "#edeeef",
              "on-tertiary-fixed-variant": "#504530",
              "surface-container-highest": "#e1e3e4",
              "outline-variant": "#c3c7ca",
              "tertiary-fixed-dim": "#d5c5a9",
              "on-tertiary": "#ffffff",
              "on-secondary": "#ffffff",
              "on-primary": "#ffffff",
              "primary-container": "#2f3e46",
              "surface-dim": "#d9dadb",
              "on-secondary-container": "#785e3e",
              "on-primary-fixed": "#0e1d25",
              "on-tertiary-fixed": "#231a08",
              "on-background": "#191c1d",
              "surface-tint": "#516169",
              "error-container": "#ffdad6",
              "on-error-container": "#93000a",
              "secondary-fixed": "#ffddb6",
              "surface": "#f8f9fa",
              "outline": "#73787b",
              "inverse-primary": "#b9c9d3",
              "on-primary-container": "#99a9b2",
              "on-surface-variant": "#43474a",
              "secondary-fixed-dim": "#e2c19b",
              "on-error": "#ffffff",
              "on-secondary-fixed": "#291801",
              "tertiary-container": "#453b26",
              "surface-variant": "#e1e3e4",
              "inverse-surface": "#2e3132",
              "background": "#f8f9fa",
              "inverse-on-surface": "#f0f1f2",
              "tertiary": "#2e2512",
              "on-surface": "#191c1d",
              "secondary": "#735a3a",
              "surface-container-high": "#e7e8e9"
            },
            fontFamily: {
              "headline": ["Manrope"],
              "body": ["Manrope"],
              "label": ["Manrope"]
            },
            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},
          },
        },
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
            vertical-align: middle;
        }
        body { font-family: 'Manrope', sans-serif; }
        .glass-nav {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(24px);
        }
    </style>
</head>
<body class="bg-surface text-on-surface antialiased">
<!-- TopAppBar -->
<header class="fixed top-0 w-full z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl flex justify-between items-center px-6 py-4 w-full shadow-sm dark:shadow-none">
<div class="flex items-center gap-4">
<button class="text-slate-900 dark:text-slate-100 active:scale-95 duration-200">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="text-lg font-bold tracking-tighter text-slate-900 dark:text-slate-50 font-manrope antialiased tracking-tight">The Residences</h1>
</div>
<div class="flex items-center gap-4">
<button class="text-slate-500 dark:text-slate-400 hover:opacity-80 transition-opacity">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<div class="w-8 h-8 rounded-full overflow-hidden bg-surface-container">
<img alt="Resident Profile" class="w-full h-full object-cover" data-alt="professional headshot of a refined man in a dark suit with a neutral luxury background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5PY7wS8ZZFDswaFSsqGESX6f5N3OKeN-Gd6QW0r4swdklIXrKF2hkRBOIUX5QB9EB0vG2YFsI4mevW4hu7yH3aPEZmHFB3laLlJK_m7lDKIobQiE4aXMOiE7Uyur5_g8wA92SMH7wnC14dNLRUrdBD7caUCjW1K79eDCNuSlWnO23jYvExud_U-fClizGf0Xm_VpqOzc6V-8jjXYkB-lqdamB7Hq5U-V9ZcZsN0LheJjBZhMzWAUe5Din8-y9JnhPR0ib3kUFF7A"/>
</div>
</div>
</header>
<main class="pt-24 pb-32 px-6 max-w-5xl mx-auto min-h-screen">
<!-- Hero Selection Context -->
<div class="mb-12">
<span class="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary mb-2 block">Amenity Booking</span>
<h2 class="text-4xl font-extrabold tracking-tight text-primary mb-4">Reserve Your Space</h2>
<div class="flex gap-4">
<button class="bg-primary text-on-primary px-6 py-3 rounded-md font-semibold text-sm transition-transform active:scale-95">Gym &amp; Fitness</button>
<button class="bg-surface-container-low text-on-surface-variant px-6 py-3 rounded-md font-semibold text-sm hover:bg-surface-container-high transition-colors">Private Sauna</button>
</div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
<!-- Calendar Section -->
<section class="lg:col-span-5">
<div class="bg-surface-container-lowest p-8 rounded-xl shadow-[0_8px_24px_rgba(25,40,48,0.04)]">
<div class="flex justify-between items-center mb-8">
<h3 class="text-xl font-bold tracking-tight text-primary">October 2023</h3>
<div class="flex gap-2">
<button class="p-2 text-on-surface-variant hover:bg-surface-container transition-colors rounded-full"><span class="material-symbols-outlined">chevron_left</span></button>
<button class="p-2 text-on-surface-variant hover:bg-surface-container transition-colors rounded-full"><span class="material-symbols-outlined">chevron_right</span></button>
</div>
</div>
<!-- Minimalist Calendar Grid -->
<div class="grid grid-cols-7 text-center mb-4">
<div class="text-[10px] uppercase tracking-widest font-bold text-outline">Mo</div>
<div class="text-[10px] uppercase tracking-widest font-bold text-outline">Tu</div>
<div class="text-[10px] uppercase tracking-widest font-bold text-outline">We</div>
<div class="text-[10px] uppercase tracking-widest font-bold text-outline">Th</div>
<div class="text-[10px] uppercase tracking-widest font-bold text-outline">Fr</div>
<div class="text-[10px] uppercase tracking-widest font-bold text-outline">Sa</div>
<div class="text-[10px] uppercase tracking-widest font-bold text-outline">Su</div>
</div>
<div class="grid grid-cols-7 gap-y-2 text-center">
<!-- Past days -->
<div class="py-3 text-surface-dim font-medium text-sm">25</div>
<div class="py-3 text-surface-dim font-medium text-sm">26</div>
<div class="py-3 text-surface-dim font-medium text-sm">27</div>
<div class="py-3 text-surface-dim font-medium text-sm">28</div>
<div class="py-3 text-surface-dim font-medium text-sm">29</div>
<div class="py-3 text-surface-dim font-medium text-sm">30</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">1</div>
<!-- Active month -->
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">2</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">3</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">4</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">5</div>
<div class="py-3 bg-primary text-on-primary font-bold text-sm rounded-lg shadow-lg scale-105">6</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">7</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">8</div>
<!-- ... rest of days omitted for brevity, adding a few more for visual balance -->
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">9</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">10</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">11</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">12</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">13</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">14</div>
<div class="py-3 text-primary font-medium text-sm cursor-pointer hover:bg-surface-container rounded-lg transition-colors">15</div>
</div>
<div class="mt-8 pt-8 border-t border-outline-variant/20">
<div class="flex items-center justify-between mb-4">
<span class="text-sm font-medium text-on-surface-variant">Selected Date</span>
<span class="text-sm font-bold text-primary">Friday, Oct 6</span>
</div>
<div class="flex items-center justify-between">
<span class="text-sm font-medium text-on-surface-variant">Amenity Type</span>
<span class="text-sm font-bold text-primary">Premier Fitness Center</span>
</div>
</div>
</div>
</section>
<!-- Time Slots Section -->
<section class="lg:col-span-7">
<div class="mb-6 flex justify-between items-end">
<div>
<h3 class="text-xl font-bold tracking-tight text-primary">Select Time</h3>
<p class="text-sm text-on-surface-variant">30-minute high-intensity windows</p>
</div>
<div class="flex gap-4 mb-1">
<div class="flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-secondary"></span>
<span class="text-[10px] font-bold uppercase tracking-wider text-outline">Available</span>
</div>
<div class="flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-surface-dim"></span>
<span class="text-[10px] font-bold uppercase tracking-wider text-outline">Booked</span>
</div>
</div>
</div>
<!-- Bento-style Time Grid -->
<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
<!-- Available Slot -->
<button class="group relative bg-surface-container-lowest p-5 rounded-xl transition-all hover:ring-2 hover:ring-secondary/20 text-left">
<div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary"></div>
<span class="block text-xs font-bold uppercase tracking-widest text-outline mb-1">Morning</span>
<span class="block text-lg font-extrabold text-primary">07:00</span>
<span class="block text-[10px] text-on-surface-variant/70">8 Slots Left</span>
</button>
<!-- Selected Slot -->
<button class="group relative bg-primary p-5 rounded-xl text-left ring-4 ring-primary/10 scale-105 shadow-xl">
<div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary"></div>
<span class="block text-xs font-bold uppercase tracking-widest text-on-primary-container mb-1">Morning</span>
<span class="block text-lg font-extrabold text-on-primary">07:30</span>
<span class="block text-[10px] text-on-primary/70">Last 2 Slots</span>
</button>
<!-- Partially Full Slot -->
<button class="group relative bg-surface-container-lowest p-5 rounded-xl transition-all hover:ring-2 hover:ring-secondary/20 text-left">
<div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary opacity-50"></div>
<span class="block text-xs font-bold uppercase tracking-widest text-outline mb-1">Morning</span>
<span class="block text-lg font-extrabold text-primary">08:00</span>
<span class="block text-[10px] text-on-surface-variant/70">4 Slots Left</span>
</button>
<!-- Fully Booked Slot -->
<div class="relative bg-surface-container-low p-5 rounded-xl text-left opacity-60 cursor-not-allowed">
<div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-surface-dim"></div>
<span class="block text-xs font-bold uppercase tracking-widest text-outline mb-1">Morning</span>
<span class="block text-lg font-extrabold text-on-surface-variant">08:30</span>
<span class="block text-[10px] text-error">Fully Booked</span>
</div>
<button class="group relative bg-surface-container-lowest p-5 rounded-xl transition-all hover:ring-2 hover:ring-secondary/20 text-left">
<div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary"></div>
<span class="block text-xs font-bold uppercase tracking-widest text-outline mb-1">Morning</span>
<span class="block text-lg font-extrabold text-primary">09:00</span>
<span class="block text-[10px] text-on-surface-variant/70">12 Slots Left</span>
</button>
<button class="group relative bg-surface-container-lowest p-5 rounded-xl transition-all hover:ring-2 hover:ring-secondary/20 text-left">
<div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary"></div>
<span class="block text-xs font-bold uppercase tracking-widest text-outline mb-1">Noon</span>
<span class="block text-lg font-extrabold text-primary">12:30</span>
<span class="block text-[10px] text-on-surface-variant/70">15 Slots Left</span>
</button>
<button class="group relative bg-surface-container-lowest p-5 rounded-xl transition-all hover:ring-2 hover:ring-secondary/20 text-left">
<div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary"></div>
<span class="block text-xs font-bold uppercase tracking-widest text-outline mb-1">Evening</span>
<span class="block text-lg font-extrabold text-primary">18:00</span>
<span class="block text-[10px] text-on-surface-variant/70">6 Slots Left</span>
</button>
<button class="group relative bg-surface-container-lowest p-5 rounded-xl transition-all hover:ring-2 hover:ring-secondary/20 text-left">
<div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary"></div>
<span class="block text-xs font-bold uppercase tracking-widest text-outline mb-1">Evening</span>
<span class="block text-lg font-extrabold text-primary">19:30</span>
<span class="block text-[10px] text-on-surface-variant/70">9 Slots Left</span>
</button>
<button class="group relative bg-surface-container-lowest p-5 rounded-xl transition-all hover:ring-2 hover:ring-secondary/20 text-left">
<div class="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-secondary"></div>
<span class="block text-xs font-bold uppercase tracking-widest text-outline mb-1">Night</span>
<span class="block text-lg font-extrabold text-primary">21:00</span>
<span class="block text-[10px] text-on-surface-variant/70">14 Slots Left</span>
</button>
</div>
<!-- Booking Summary Action -->
<div class="mt-12 p-8 bg-surface-container-high rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
<div class="flex items-center gap-4">
<div class="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-secondary shadow-sm">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">fitness_center</span>
</div>
<div>
<p class="text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant">Your Session</p>
<p class="text-lg font-extrabold text-primary leading-tight">Oct 6 • 07:30 AM</p>
</div>
</div>
<button class="w-full md:w-auto bg-primary text-on-primary px-12 py-4 rounded-md font-bold tracking-tight text-base shadow-xl hover:translate-y-[-2px] transition-all active:scale-95">
                        Confirm Booking
                    </button>
</div>
</section>
</div>
</main>
<!-- BottomNavBar -->
<nav class="fixed bottom-0 left-0 w-full flex justify-around items-center pt-3 pb-8 px-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-t-[0.5px] border-slate-200/20 z-50 shadow-[0_-8px_24px_rgba(25,40,48,0.04)]">
<a class="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 active:scale-90 duration-200" href="#">
<span class="material-symbols-outlined" data-icon="home_work">home_work</span>
<span class="font-manrope text-[10px] uppercase tracking-[0.1em] font-medium">Home</span>
</a>
<a class="flex flex-col items-center justify-center text-[#735a3a] dark:text-[#a68b6a] scale-110 transition-transform active:scale-90 duration-200" href="#">
<span class="material-symbols-outlined" data-icon="fitness_center" style="font-variation-settings: 'FILL' 1;">fitness_center</span>
<span class="font-manrope text-[10px] uppercase tracking-[0.1em] font-medium">Amenities</span>
</a>
<a class="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 active:scale-90 duration-200" href="#">
<span class="material-symbols-outlined" data-icon="event_available">event_available</span>
<span class="font-manrope text-[10px] uppercase tracking-[0.1em] font-medium">My Stay</span>
</a>
<a class="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 active:scale-90 duration-200" href="#">
<span class="material-symbols-outlined" data-icon="admin_panel_settings">admin_panel_settings</span>
<span class="font-manrope text-[10px] uppercase tracking-[0.1em] font-medium">Admin</span>
</a>
</nav>
</body></html>