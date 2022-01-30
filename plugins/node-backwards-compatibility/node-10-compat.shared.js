if(String.prototype.matchAll===undefined){
	/**
	 * matchAll
	 * Like match but returns everything.
	 *
	 * @name next
	 * @function
	 * @param {string} regex
	 * @return {string|null}
	 */
	String.prototype.matchAll = function(regex) {
		let str = this;
		/**
		 * next
		 * Get the next match in single group match.
		 *
		 * @name next
		 * @function
		 * @return {string|null}
		 */
		function next () {
			let c = regex.exec(str);
			if (c) {
				for (let i = 1; i < c.length; i++) {
					if (c[i]) {
						return c[i];
					}
				}
			}
			return null;
		}

		let res = [], c = null;
		while (c = next()) {
			res.push(c);
		}
		return res;
	};
}