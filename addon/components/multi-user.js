import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
	socket: service("web-socket"),

	init() {
		this._super(...arguments);
		this.get("socket").start();
	}

});
