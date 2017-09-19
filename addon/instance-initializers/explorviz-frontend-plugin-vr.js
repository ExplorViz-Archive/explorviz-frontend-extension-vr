import Router from "explorviz-ui-frontend/router";

export function initialize(app) {
	let service = app.lookup("service:page-setup");
	if(service){
		service.get("navbarRoutes").push("VR");
}
	
	Router.map(function(){
		this.route("VR");
	});
}

export default {
  name: 'explorviz-frontend-plugin-vr',
  initialize
};
