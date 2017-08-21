export function initialize(app) {
	let service = app.lookup("service:navbar-labels");
	service.get("navbarLabels").push("vr");
}

export default {
  name: 'explorviz-frontend-plugin-vr',
  initialize
};
