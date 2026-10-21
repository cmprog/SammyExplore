// A quick page flip (T-015): a storybook page sweeps across the view and away again, like the
// narrator turning a page. A light cousin of the correction's page (drawPageScribble), same paper,
// no scribbles, and over in under a second. The Companion uses it to bring the cat to Sammy when
// there's nowhere out of sight for her to come in from. It never locks input.
// state: { progress 0..1 } (0 nothing, 0.5 the page covers the whole view, 1 gone again).
import { mainCanvasSize, smoothStep, clamp } from 'littlejs';
import { drawScreenCanvas } from './screenCanvas.js';

const COLORS = {
    page: 'rgb(244, 228, 186)',
    pageShade: 'rgb(226, 204, 152)',
    edge: '#a07a48',
    shadow: 'rgba(40, 25, 10, .28)',
    lines: 'rgba(160, 122, 72, .28)',
};
const CURL = 150;        // pixels: how far the leading edge bows, like a page mid-turn
const SHADOW = 60;       // pixels of soft shadow ahead of the page
const LINE_GAP = 74;     // faint ruled lines on the paper

/** @param {{progress:number}} state  @param {number} time */
export function drawPageFlip({ progress }, time)
{
    const size = mainCanvasSize;
    // In: the page's leading edge sweeps right to left over the view. Out: its trailing edge follows.
    const sweepIn = smoothStep(clamp(progress / .45, 0, 1));
    const sweepOut = smoothStep(clamp((progress - .55) / .45, 0, 1));
    const span = size.x + CURL * 2;
    const lead = size.x + CURL - sweepIn * span;     // leading edge x (moves left)
    const trail = size.x + CURL - sweepOut * span;   // trailing edge x (follows it)
    if (sweepOut >= 1 || sweepIn <= 0)
        return;
    drawScreenCanvas(ctx =>
    {
        const bow = Math.sin(sweepIn * Math.PI) * CURL;   // most curl mid-sweep
        const edge = (x, curl) => y => x - curl * Math.sin(y / size.y * Math.PI);
        const leadAt = edge(lead, bow), trailAt = edge(trail, Math.sin(sweepOut * Math.PI) * CURL);
        // Soft shadow ahead of the leading edge.
        const shadow = ctx.createLinearGradient(lead - SHADOW - bow, 0, lead, 0);
        shadow.addColorStop(0, 'rgba(0,0,0,0)');
        shadow.addColorStop(1, COLORS.shadow);
        ctx.fillStyle = shadow;
        ctx.fillRect(lead - SHADOW - bow, 0, SHADOW + bow, size.y);
        // The page: between the trailing edge (right) and the leading edge (left).
        ctx.beginPath();
        for (let y = 0; y <= size.y; y += 24)
            ctx.lineTo(leadAt(y), y);
        for (let y = size.y; y >= 0; y -= 24)
            ctx.lineTo(trailAt(y), y);
        ctx.closePath();
        const paper = ctx.createLinearGradient(lead, 0, lead + 260, 0);
        paper.addColorStop(0, COLORS.pageShade);
        paper.addColorStop(1, COLORS.page);
        ctx.fillStyle = paper;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = COLORS.lines;
        ctx.lineWidth = 3;
        for (let y = LINE_GAP; y < size.y; y += LINE_GAP)
        {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size.x, y);
            ctx.stroke();
        }
        ctx.restore();
        // The curled leading edge.
        ctx.strokeStyle = COLORS.edge;
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let y = 0; y <= size.y; y += 24)
            ctx.lineTo(leadAt(y), y);
        ctx.stroke();
    });
}
