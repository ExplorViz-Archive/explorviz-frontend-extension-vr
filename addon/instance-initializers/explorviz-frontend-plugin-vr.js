export function initialize(app) {
	let service = app.lookup("service:navbar-labels");
	service.get("navbar-labels").push("vr");
}

export default {
  name: 'explorviz-frontend-plugin-vr',
  initialize
};
