import Router from "explorviz-ui-frontend/router";

export function initialize(app) {
	let service = app.lookup("service:navbar-labels");
	service.get("navbarLabels").push("vr");
	
	Router.map(function(){
		this.route("vr");
	});
}

export default {
  name: 'explorviz-frontend-plugin-vr',
  initialize
};
