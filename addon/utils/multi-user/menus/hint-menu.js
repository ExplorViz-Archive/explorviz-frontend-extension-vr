import Menu from '../menu';

let menu = null;

export function showHint(hint, blinks) {
  const self = this;
  close.call(this);
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
      close.call(this);
    }
  };

  menu.createMesh();

  const mesh = menu.getMesh();
  mesh.position.y -= 0.1;
  mesh.position.z -= 0.3;
  mesh.rotateX(-0.18);
  mesh.scale.x = 0;

  let dir = 1;
  let moved = 0.0;
  let counter = 0;

  this.camera.add(mesh);
  function animate() {
    if(!menu)
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
      requestAnimationFrame(animate);
    } else {
      counter = 0;
      animateClose();
    }
  }
  function animateOpen() {
    if(!menu)
      return;

    moved += 0.05;
    if (moved >= 0 && moved < 1) {
      mesh.scale.x += 0.05;
    } else if (moved >= 1) {
      moved = 0;
      animate();
      return;
    }
    requestAnimationFrame(animateOpen);
  }
  function animateClose() {
    if(!menu)
      return;

    moved += 0.05;
    if (moved >= 0 && moved < 1) {
      mesh.scale.x -= 0.05;
    } else if (moved >= 1) {
      moved = 0;
      close.call(self);
      return;
    }
    requestAnimationFrame(animateClose);
  }
  animateOpen();
}

function close() {
  if(menu) {
    this.camera.remove(menu.getMesh());
    menu.close();
    menu = null;
  }
}