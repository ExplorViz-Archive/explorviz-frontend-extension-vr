import Router from "explorviz-ui-frontend/router";

export function initialize(app) {
	let service = app.lookup("service:navbar-labels");
	if(service){
		service.get("navbarLabels").push("VR");
}
	
	Router.map(function(){
		this.route("VR");
	});
}

export default {
  name: 'explorviz-frontend-plugin-vr',
  initialize
};
