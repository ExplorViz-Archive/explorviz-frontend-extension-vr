import Menu from '../menu';

let menu = null;

export function showHint(hint, blinks) {
  const self = this;
  close.call(this, menu);
  menu = new Menu({
    title: 'hintMenu',
    resolution: { width: 512, height: 128 },
    size: { width: 0.2, height: 0.05 },
    opacity: 0.7,
    color: '#002e4f'
  });
  menu.addText(hint, 'text', 28, { x: 256, y: 50}, '#ffffff', 'center', false);
  menu.interact = (action, position) => {
    if(action === 'rightTrigger') {
      close.call(this, menu);
    }
  };

  menu.createMesh();

  // move mesh to middle of the screen and set initial size to 0 (invisible)
  const mesh = menu.getMesh();
  mesh.position.y -= 0.1;
  mesh.position.z -= 0.3;
  mesh.rotateX(-0.18);
  mesh.scale.x = 0;

  let thismenu = menu;
  let dir = 1;
  let moved = 0.0;
  let counter = 0;

  this.get('camera').add(mesh);

  // menu's stretch-open animation
  function animateOpen() {
    if(!thismenu)
      return;

    moved += 0.05;
    if (moved >= 0 && moved < 1) {
      mesh.scale.x += 0.05;
    } else if (moved >= 1) {
      // if opened, make menu pulsate
      moved = 0;
      animatePulsation();
      return;
    }
    requestAnimationFrame(animateOpen);
  }
  // animates hint menu's pulsation effect
  function animatePulsation() {
    if(!thismenu)
      return;
    moved += 0.00075;
    if(counter < 2*blinks) {
      if (moved >= 0 && moved < 0.015) {
        mesh.position.z += dir * 0.00075;
      } else if (moved >= 0.015) {
        mesh.position.z += dir * 0.00075;
        dir *= -1;
        moved = 0;
        counter++;
      }
      requestAnimationFrame(animatePulsation);
    } else {
      // if pulsation done, close menu
      counter = 0;
      animateClose();
    }
  }
  // animtes menu closing animation, the reverse of the open animation
  // closes menu afterward
  function animateClose() {
    if(!thismenu)
      return;

    moved += 0.05;
    if (moved >= 0 && moved < 1) {
      mesh.scale.x -= 0.05;
    } else if (moved >= 1) {
      // if close animation done, actually close menu.
      moved = 0;
      close.call(self, thismenu);
      return;
    }
    requestAnimationFrame(animateClose);
  }
  animateOpen();
}

function close(menue) {
  if(menue) {
    this.get('camera').remove(menue.getMesh());
    menue.close();
    menue = null;
  }
}