
export function createFoundation(emberApplication, store, point) {
  const idTest = parseInt(Math.random() * (20000 - 10000) + 10000);
  const foundation = store.createRecord('component', {
    id: idTest,
    synthetic: false,
    foundation: true,
    children: [emberApplication.get('components').objectAt(0)],
    clazzes: [],
    belongingApplication: emberApplication,
    opened: true,
    name: emberApplication.get('name'),
    fullQualifiedName: emberApplication.get('name'),
    positionX: point.x,
    positionY: point.y,
    positionZ: point.z,
    width: 0,
    height: 0,
    depth: 0
  });

  emberApplication.get('components').objectAt(0).set('parentComponent', foundation);
  emberApplication.set('components', [foundation]);

  return foundation;
}

export function removeFoundation(emberApplication, store) {
  const foundation = emberApplication.get('components').objectAt(0);

  if(foundation.get('foundation')) {
    emberApplication.set('components', foundation.get('children'));
    emberApplication.get('components').objectAt(0).set('parentComponent', null);
    store.unloadRecord(foundation);
  }
  return true;
}