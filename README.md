# Mari Avatar Viewer — setup on Windows

This is a small program that shows your 3D model (your `.glb` file) exactly the way it
will look on the Mari kiosk: the same camera, the same lights, the same background. You
load your own file into it, look at it, fix what needs fixing in Blender, and load it
again.

It runs on your own computer. Your file is not uploaded anywhere — not to GitHub, not
to us — and once you have the folder, the viewer itself does not need the internet.

**Do the steps in order. The whole thing takes about five minutes, once.**

---

## Step 1 — Download the folder from GitHub

You do **not** need a GitHub account, and you do not need to install Git.

1. Open <https://github.com/hassan-sanaullah1/Mari-Avatar-Viewer> in your browser.
2. Click the green **Code** button near the top right.
3. Click **Download ZIP**. It saves to your Downloads folder as
   `Mari-Avatar-Viewer-main.zip`.
4. Go to your Downloads folder, right-click that ZIP and choose **Extract All…**, then
   click **Extract**.
5. Move the folder it produced to your **Desktop** or your **Documents**.

> **Step 4 matters.** Do not open the ZIP and run things straight out of it. Windows
> runs files from inside a ZIP in a hidden temporary folder, and it will not work.
> Extract it first.

Open the folder. You should see files called `index.html`, `start.bat` and `serve.py`,
and folders called `src`, `assets` and `vendor`. If instead you see a single folder
inside, open that one — that is the real folder.

> **Later on, to get an updated version:** do this same step again and extract it over
> the top, or into a new folder. Nothing else changes, and Step 2 never has to be
> repeated.

---

## Step 2 — Install Python (one time only)

The viewer needs Python in order to show itself in your browser. You will never have to
open Python or type anything into it — it only has to be on the computer.

**The easy way (Windows 10 and 11):**

1. Open the **Start menu**, type `python`, and press Enter.
2. If Python is not installed yet, the **Microsoft Store** opens on the Python page.
   Click **Get** (or **Install**) and wait for it to finish.
3. Close the Store.

**If that does not open the Store:**

1. Go to <https://www.python.org/downloads/>.
2. Click the big yellow **Download Python** button.
3. Run the file that downloads.
4. **Important:** on the very first screen, tick the box at the bottom that says
   **"Add python.exe to PATH"**. Then click **Install Now**.
5. When it finishes, click **Close**.

That is the only thing to install. You do not need Node, a code editor, or anything else.

---

## Step 3 — Start the viewer

1. Open the `mari-avatar-viewer` folder.
2. Double-click **`start.bat`**.

Two things happen:

- A black window opens with a few lines of text in it. **Leave it open.** That window
  *is* the viewer running. Closing it stops the viewer.
- Your browser opens at an address like `http://localhost:8080/` and shows a dark blue
  and green background with "Drop a .glb here" in the middle.

If the browser does not open on its own, look at the black window — the address is
printed in the middle of the text. Type it into your browser yourself.

**Windows may ask about the firewall.** Either button is fine; the viewer only talks to
your own computer.

---

## Step 4 — Load your model

Either:

- Drag your `.glb` file out of File Explorer and drop it anywhere on the picture, or
- Click the blue **Upload .glb** button on the right.

Large files take a moment the first time — a 60 MB model can take about a minute.

That is it. You can drop a new file on top at any time, as often as you like.

---

## Stopping, and starting again

- **To stop:** close the black window.
- **To start again:** double-click `start.bat` again. Step 2 never has to be repeated.

---

## What the controls do

The panel is on the right. Press the **H** key (or the **Hide** button) to put it away
and see the picture on its own; press **H** again to bring it back.

| Control | What it does |
|---|---|
| **Upload .glb** | Loads your model. Dragging a file onto the picture does the same. |
| **Preset: Female / Male** | The two presenters are framed and lit differently on the kiosk. Pick the one your model is replacing. |
| **Theme: Dark / Light** | The kiosk has both. A model that looks right in one can look wrong in the other, so check both. |
| **Light state** | Idle, listening, thinking, speaking. The lights brighten and dim as the kiosk talks. |
| **Clip, Play, Restart** | Plays the animations inside your file. The slider under them scrubs through, and **Speed** slows it down. |
| **Orbit to inspect** | Lets you drag with the mouse to look around and scroll to zoom. Turn it off, or click **Reset camera**, to go back to the kiosk's real camera — that is the one that counts. |
| **Kiosk material pass** | On = exactly what the kiosk does to your materials. Off = your materials raw, as you made them. Leave it on unless you are comparing the two. |
| **Camera sway** | The kiosk drifts the camera very slightly so the picture does not look like a photograph. Turn it off when you are judging a fine edge. |
| **Wireframe** | Shows the mesh instead of the surface. |

To see your model the way a visitor sees it: pick the right **Preset**, leave the theme
on **Dark**, leave everything else alone, and press **H**.

---

## The "Checks" list

It is at the bottom of the panel. Grey lines are fine. **Orange lines are worth a look:**

- **Height** — the female presenter is 1.68 m tall and the male 1.85 m, measured to the
  top of the head. The kiosk's camera sits just above the head, so a model much taller
  or shorter than that sits wrong in the frame.
- **Feet on the floor** — in Blender the feet should sit at zero, on the ground.
- **Centred** — the kiosk's camera always looks straight down the middle, so centre the
  model side to side.
- **Roughness 1.0** — a material saved with no roughness value comes out completely
  matte, and the blue and green edge lights stop showing along the clothes. Give every
  material a real roughness; the current models use about 0.5 on cloth and skin.
- **Specular above 1.0** — makes a surface reflect more light than falls on it. It shows
  up as a hard shine, worst on dark hair.
- **Texture size** — the kiosk draws the whole head about 110 pixels tall. 2048 is
  already generous; 4096 is a slow download for nothing you can see.
- **Material names** — this one is easy to miss. The kiosk brightens the skin, tones the
  makeup down and adjusts the clothing **by material name**. If those materials get
  renamed, the kiosk quietly stops doing any of it and the presenter comes out darker
  and flatter than it should. The list names exactly which it found and which it did
  not. Either keep the names, or tell us the new ones.
- **ARKit face shapes** — only matters if this model has to talk on the kiosk.

---

## Sending the model back

Send the `.glb` file itself. Two things to remember:

1. **Give every new export a new file name** — `mari_male_14.glb`, not `mari_male.glb`
   again. The kiosk tells browsers to keep a model forever, so reusing a name means
   people carry on seeing the old one.
2. **Keep the animation and bone names the same** between exports where you can. The
   kiosk plays particular slices of the animation by time, and if the animation changes
   length those have to be measured again by hand.

---

## If something goes wrong

**The black window flashes up and disappears.**
Python is missing, or it was installed without the PATH box ticked. Do Step 2 again and
make sure you tick **"Add python.exe to PATH"**.

**It says `'python' is not recognized…`**
Same thing. Do Step 2 again.

**The browser says "This site can't be reached".**
The black window has been closed. Double-click `start.bat` again and leave it open.

**The browser opens but the page is blank or white.**
You are probably double-clicking `index.html`. That cannot work — browsers block it.
Always start with `start.bat` and use the `http://localhost:8080/` address.

**The page still looks like an older version after an update.**
Hold `Ctrl` and press `F5` to make the browser fetch it again.

**I can only see part of my model.**
That is correct — the kiosk shows the presenter from roughly the waist up. Tick **Orbit
to inspect** if you want to look at all of it.

**My model does not appear at all.**
Look at the Checks panel, at the height and the "feet on the floor" lines. A model
exported in centimetres instead of metres comes out a hundred times too big, and the
camera ends up inside it.

**Something else is using the address 8080.**
The viewer picks the next free one by itself and prints it in the black window. Use the
address it printed rather than one you remember.

---

## On a Mac or on Linux

Open a terminal in the folder and run `./start.sh`. Everything else is the same, and
Python is already installed on both.

---

## Who to ask

If one of the steps above does not work, send a photo of the black window and of the
browser. That is almost always enough to say what happened.

*(Technical notes about how this mirrors the kiosk are in `MAINTAINING.md` — you do not
need them.)*
