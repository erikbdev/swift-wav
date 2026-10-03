<template>
  <aside
    id="preview-pane"
    class="flex min-h-0 min-w-0 flex-[1.15] flex-col border-l border-border bg-bg-2 max-[800px]:min-h-[300px] max-[800px]:flex-[1_1_42%] max-[800px]:border-t max-[800px]:border-l-0"
  >
    <div class="flex min-h-10 items-center justify-between border-b border-border-faint px-3.5 text-[11px] font-semibold tracking-[0.04em] text-text-2">
      <span>TIMELINE</span>
      <span class="font-mono text-[10px] tracking-normal text-text-3">4/4 · 120 BPM</span>
    </div>

    <div id="timeline-content" class="min-h-0 flex-1 overflow-auto bg-bg-2 pb-4.5">
      <div class="sticky top-0 z-2 grid min-h-7 grid-cols-[116px_minmax(520px,1fr)] border-b border-border bg-bg-2/96">
        <div class="sticky left-0 z-1 flex items-center border-r border-border-faint bg-bg-2 pl-3 font-mono text-[9px] tracking-[0.08em] text-text-3">TRACKS</div>
        <div class="grid grid-cols-[repeat(8,minmax(65px,1fr))] items-center">
          <span v-for="bar in 8" :key="bar" class="h-full border-r border-border-faint px-1.75 pt-2 font-mono text-[9px] text-text-3">{{ bar }}</span>
        </div>
      </div>

      <!-- TODO: dynamically calculate timeline-row -->
      <div class="grid min-h-19 grid-cols-[116px_minmax(520px,1fr)] border-b border-border-faint">
        <div class="sticky left-0 z-2 flex items-center gap-2 border-r border-border-faint bg-bg-1 pr-2.5 pl-3">
          <span class="h-6 w-1 rounded bg-accent"></span>
          <div>
            <div class="text-[11px] text-text-0">Drums</div>
          </div>
        </div>
        <div class="track-lane relative min-w-[520px]">
          <div class="absolute top-4 z-1 flex h-11 min-w-23 flex-col justify-center rounded border-l-3 border-accent-hi bg-accent/22 px-2.25 text-[10.5px] text-text-0" style="left: 1%; width: 35%">
            <span>Beat pattern</span>
            <small class="font-mono text-[9px] text-[rgba(255,244,230,0.58)]">8 bars</small>
          </div>
        </div>
      </div>

      <!-- <div class="grid min-h-19 grid-cols-[116px_minmax(520px,1fr)] border-b border-border-faint"> -->
      <!--   <div class="sticky left-0 z-2 flex items-center gap-2 border-r border-border-faint bg-bg-1 pr-2.5 pl-3"> -->
      <!--     <span class="h-6 w-1 rounded bg-blue"></span> -->
      <!--     <div> -->
      <!--       <div class="text-[11px] text-text-0">Bass</div> -->
      <!--       <span class="mt-0.75 block font-mono text-[9px] tracking-[0.05em] text-text-3">MIDI</span> -->
      <!--     </div> -->
      <!--   </div> -->
      <!--   <div class="track-lane relative min-w-[520px]"> -->
      <!--     <div class="absolute top-4 z-1 flex h-11 min-w-23 flex-col justify-center rounded border-l-3 border-blue bg-blue/19 px-2.25 text-[10.5px] text-text-0" style="left: 25%; width: 49%"> -->
      <!--       <span>Low groove</span> -->
      <!--       <small class="font-mono text-[9px] text-[rgba(255,244,230,0.58)]">bars 3–6</small> -->
      <!--     </div> -->
      <!--   </div> -->
      <!-- </div> -->
      <!---->
      <!-- <div class="grid min-h-19 grid-cols-[116px_minmax(520px,1fr)] border-b border-border-faint"> -->
      <!--   <div class="sticky left-0 z-2 flex items-center gap-2 border-r border-border-faint bg-bg-1 pr-2.5 pl-3"> -->
      <!--     <span class="h-6 w-1 rounded bg-purple"></span> -->
      <!--     <div> -->
      <!--       <div class="text-[11px] text-text-0">Harmony</div> -->
      <!--       <span class="mt-0.75 block font-mono text-[9px] tracking-[0.05em] text-text-3">MIDI</span> -->
      <!--     </div> -->
      <!--   </div> -->
      <!--   <div class="track-lane relative min-w-[520px]"> -->
      <!--     <div class="absolute top-4 z-1 flex h-11 min-w-23 flex-col justify-center rounded border-l-3 border-purple bg-purple/18 px-2.25 text-[10.5px] text-text-0" style="left: 50%; width: 37%"> -->
      <!--       <span>Chord sketch</span> -->
      <!--       <small class="font-mono text-[9px] text-[rgba(255,244,230,0.58)]">bars 5–7</small> -->
      <!--     </div> -->
      <!--   </div> -->
      <!-- </div> -->
    </div>
  </aside>
</template>

<style scoped>
/* Bar lines every 12.5% (8 bars) and beat lines every 3.125% (4 beats per bar). */
.track-lane {
  background-image: repeating-linear-gradient(to right, transparent 0, transparent calc(12.5% - 1px), var(--color-border-faint) calc(12.5% - 1px), var(--color-border-faint) 12.5%);
}
.track-lane::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(to right, transparent 0, transparent calc(3.125% - 1px), rgba(255, 244, 230, 0.025) calc(3.125% - 1px), rgba(255, 244, 230, 0.025) 3.125%);
}
</style>
