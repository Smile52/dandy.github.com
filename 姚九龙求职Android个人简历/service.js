var api_base = localStorage.getItem('api_base');
if (!api_base)
	api_base = (location.hostname.indexOf('localhost') != -1 || location.hostname.indexOf('i.jobdeer.com') != -1 || location.hostname.indexOf('deersite.sinaapp.com') != -1) ? "http://jay.deercvapi.i.jobdeer.com/" : "http://tt1535.sinaapp.com/";

angular.module('jobdeer.service', [])
	.constant('jconfig', {
	api_base: api_base,
	is_test : location.hostname.indexOf('i.jobdeer.com') !== -1
})

	.config(function ($httpProvider, $provide) {

	var error_log_times = 0;
	$provide.decorator("$exceptionHandler", function ($delegate, $injector) {
		return function (exception, cause) {
			var $http = $injector.get('$http');
			if ('undefined' == typeof (navigator) || !navigator.userAgent) {
				var browser = '不支持navigator.userAgent';
			}
			else {
				var browser = navigator.userAgent;
			}
			//同一人触发了10次报警就不在报警
			if (error_log_times < 10) {
				if (location.host) {
					//屏蔽用户将代码下载到本地运行的情况
					$http.post('http://jdlog.vipsinaapp.com/log', { msg: '##前端JS错误##' + '错误信息：' + exception.stack + ',<br />用户浏览器：' + browser + '<br />访问地址：' + location.href, type: 'js_error', site: 'front', send_mail: 1 });
				}
				error_log_times++;
			}
			$delegate(exception, cause);
		};
	});

	//对php的post处理
	$httpProvider.defaults.transformRequest = function (request) {
		if (typeof (request) != 'object') {
			return request;
		}
		var str = [];
		for (var k in request) {
			if (k.charAt(0) == '$') {
				delete request[k];
				continue;
			}
			var v = 'object' == typeof (request[k]) ? JSON.stringify(request[k]) : request[k];
			str.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
		}
		return str.join("&");
	};
	$httpProvider.defaults.timeout = 10000;
	$httpProvider.defaults.headers.post = {
		'Content-Type': 'application/x-www-form-urlencoded'
	};
	$httpProvider.responseInterceptors.push('interceptor');


})
	.factory('interceptor', function ($q, jconfig, $injector) {
	return function (promise) {
		return promise.then(function (response) {
			if ('object' != typeof (response.data)) {
				if (0 === response.config.url.indexOf(jconfig.api_base)) {
					//如果请求接口返回的内容不是json数据，则报错
					console.log('服务出错，请稍后再试!');
					console.log(response);
					return $q.reject({ code: -3, messge: "response format error" });
				}
				return response;
			}
			//如果返回错误码, 标记为错误
			if (response.data.code) {
				var redirect_to_login = function () {
					//TODO 重新登录
				};
				//常见错误处理
				if (response.data.code) {
					if ('10001' == response.data.code) {
						//swal(response.data.message);
						alert(response.data.message);
						response.data.code = -1;
						return $q.reject(response);
					}
					if ('10002' == response.data.code) {
						//swal('权限错误，请重新登录',redirect_to_login);
						alert('权限错误，请重新登录');
						//错误码在设置为小于0，避免重复判断错误
						response.data.code = -2;
						return $q.reject(response);
					}
					if ('10003' == response.data.code) {
						//swal('登录超时，请重新登录',redirect_to_login);
						alert('登录超时，请重新登录');
						//错误码在设置为小于0，避免重复判断错误
						response.data.code = -3;
						return $q.reject(response);
					}
					if ('30001' == response.data.code) {
						//swal('数据库出错');
						alert('数据库出错');
						response.data.code = -4;
						return $q.reject(response);
					}
					if ('99999' == response.data.code) {
						var message = response.data.message.replace('其他 -', '');
						//swal(message);
						alert(message);
						response.data.code = -5;
						return $q.reject(response);
					}
				}
				//调用接口错误
				return $q.reject(response);
			}
			//去除错误码，只返回数据部分
			if ('undefined' != typeof (response.data.data)) {
				response.data = response.data.data;
			}
			return response;
		}, function (response) {
				console.log('服务器端出错');
				console.log(response);
				response.data = {
					code: -6,
					message: response
				};
				return $q.reject(response);
			});
	};
})
//JobDeer 工具
	.factory('$jd', function ($http, jconfig, $timeout, $location) {
	return {
		apiurl: function (url) {
			/*
			if(-1==url.indexOf('?'))
			{
					url+="?app_key="+jconfig.app_key;
			}
			else
			{
					url+="&app_key="+jconfig.app_key;
			}
			*/
			return jconfig.api_base + url;
		},
		get: function (url) {
			url = this.apiurl(url);
			return $http.get(url);
		},
		post: function (url, param) {
			url = this.apiurl(url);
			return $http.post(url, param);
		},
		//监听请求条件的变化，可以间隔自动刷新列表
		watch: function (scope, timeout, change_search) {
			if ('undefined' == typeof (change_search)) {
				//是否改变url的querystring
				change_search = false;
			}
			var success_cb = function (data) { };
			var error_cb = function (data) { };
			var cb = {
				success: function (func) {
					//设置成功的回调函数
					success_cb = func;
					return cb;
				},
				error: function (func) {
					//设置失败的回调函数
					error_cb = func;
					return cb;
				},
				reload: function () {
					run();
				}
			};

			if (!scope.request) {
				alert('watch 方法没有指定scope.request');
				return;
			}

			if (!scope.request.url) {
				alert('watch 方法没有指定scope.request.url');
				return;
			}

			if (!scope.request.params) {
				scope.request.params = {};
			}

			scope.request.reload = function () {
				run();
			};

			var self = this;
			var run = function () {
				var url = self.apiurl(scope.request.url);
				if (url.indexOf('?') == -1) {
					url += '?' + $.param(scope.request.params)
				}
				else {
					url += '&' + $.param(scope.request.params)
				}
				$http.get(url).success(success_cb).error(error_cb);
				if (change_search) {
					$location.search(scope.request.params);
				}
			};
			scope.$watch('request', run, true);

			if (timeout) {
				timeout = timeout * 1000;
				//如果设置了timeout，会实时刷新
				cancelRefresh = $timeout(function myFunction() {
					run();
					cancelRefresh = $timeout(myFunction, timeout);
				}, timeout);

				//切换到其他页面后，终止自动刷新
				scope.$on('$destroy', function (e) {
					$timeout.cancel(cancelRefresh);
				});
			}
			return cb;
		}
	};
})
	.filter('default', function () {
	return function (data, default_value) {
		return data ? data : default_value;
	};
})
	.filter('undefined', function () {
	return function (data) {
		return 'undefined' == typeof (data);
	};
})

	.filter('empty', function () {
	return function (data) {
		if ('undefined' == typeof (data)) {
			return false;
		}
		return data ? false : true;
	};
})

	.filter('unsafe', ['$sce', function ($sce) {
	return function (val) {
		return $sce.trustAsHtml(val);
	};
}])

	.filter('jdate', function ($filter) {
	return function (date, format) {
		var arr = date.split(/[- :]/),
			time = new Date(arr[0], arr[1] - 1, arr[2], arr[3], arr[4], arr[5]);
		//转换字符串为时间戳再格式化
		//为什么不用 Date.parse(str) 直接转换字符串为时间戳,  因为 Date.parse 支持的字符串时间格式有限，容易返回NaN
		return $filter('date')(time.getTime(), format);
	};
})
	.directive('jpage', function () {
	return {
		restrict: "EA",
		replace: true,
		template: '<ul class="pagination" ng-if="show"><li ng-click="go({page:1})"><a href="javascript:void(0);" title="首页">&laquo;</a></li><li ng-repeat="page in pages"  ng-class="{active:page==currentpage}"  ng-click="go({page:page})"><a href="javascript:void(0);">{{page}}</a></li><li ng-click="go({page:totalpage})"><a href="javascript:void(0);" title="尾页">&raquo;</a></li></ul>',
		scope: {
			//总页数
			totalpage: "=",
			//当前页数
			currentpage: "=",
			//显示分页个数,默认为10
			size: "=",
			//分页回调函数,传递参数page
			go: "&"
		},
		controller: function ($scope, $element, $attrs, $transclude) {
			var run = function () {
				var totalpage = parseInt($scope.totalpage);
				//要有两页才显示分页
				$scope.show = totalpage > 1 ? true : false;
				if (!$scope.show)
					return;
				var currentpage = parseInt($scope.currentpage);
				var size = $scope.size ? parseInt(size) : 10;
				var half_size = parseInt((size + 1) / 2);
				var start_page = currentpage - half_size;
				if (start_page < 1) {
					half_size += Math.abs(start_page);
					start_page = 1;
				}
				var end_page = currentpage + half_size;
				if (end_page > totalpage) {
					var start_page = start_page - (end_page - totalpage);
					if (start_page < 1)
						start_page = 1;
					end_page = totalpage;
				}
				var pages = [];
				for (i = start_page; i <= end_page; i++) {
					pages.push(i);
				}
				$scope.pages = pages;
				$scope.totalpage = totalpage;
				$scope.currentpage = currentpage;
			};
			$scope.$watch('totalpage+currentpage', function () {
				//计算更改pages变量
				run();
			});
		}
	};
})

	.directive('loadstatus', function ($timeout) {
	return {
		restrict: "EA",
		replace: false,
		scope: {
			loadtext: "@loadstatus"
		},
		link: function (scope, element, attrs, ngModel) {
			//监听元素点击事件
			$(element).on('click', function () {
				$timeout(function () {
					//立即disabled会导致表单不能提交，所以timeout一下
					$(element).prop('disabled', true);
				}, 0)
				if (scope.loadtext) {
					var oldvalue = $(element).val();
					var is_val = true;
					if (!oldvalue) {
						//val 获得不了用html
						is_val = false;
						oldvalue = $(element).html();
					}
					//加载中的文字
					if (is_val) {
						$(element).val(scope.loadtext);
					}
					else {
						$(element).html(scope.loadtext);
					}
				}
				$timeout(function () {
					$(element).prop('disabled', false);
					if (scope.loadtext) {
						if (is_val) {
							$(element).val(oldvalue);
						}
						else {
							$(element).html(oldvalue);
						}
					}
				}, 2000);
			});
		}
	};
})
	.factory('jdModal', function ($rootScope, $http, $templateCache, $compile, $controller) {
	if ($('#jobdeer-modal').size() == 0) {
		$('<div class="modal fade" id="jobdeer-modal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true"><div class="modal-dialog"><div class="modal-content"></div></div></div>').appendTo('body');
	}
	return function (templateUrl, controller, scope) {
		scope = scope || $rootScope.$new();
		scope.closeModal = function () {
			$('#jobdeer-modal').modal('hide');
		};
		$http.get(templateUrl, { cache: $templateCache }).success(function (data) {
			var modal_content = $('#jobdeer-modal').find('.modal-content');
			modal_content.html(data);
			var link = $compile(modal_content);
			if (controller) {
				var ctrl = $controller(controller, { $scope: scope });
				modal_content.data('$ngControllerController', ctrl);
			}
			link(scope);
			$('#jobdeer-modal').modal('show');
		}).error(function () {
			alert('请求模板地址：' + templateUrl + '失败');
		});
	};
})
	.directive('ghostDown', function ($timeout, $rootScope, $compile, $controller) {
	return {
		//风格，E元素，A属性, C样式类，M注释
		restrict: "EA",
		scope: {
			ghostDown: "=ghostDown",
			canWeixinScan: "=",
			cb: "&",// 注意&符合的传承方式，自能属性中，带上参数名,如：<name  cb="funcname(message)" />
		},
		link: function (scope, element, attrs, ngModel) {
			var converter = new Showdown.converter();
			scope.$watch('ghostDown', function () {
				if (scope.ghostDown) {
					var converter = new Showdown.converter();
					var value = scope.ghostDown;
					//password 处理
					if (value) {
						var html = converter.makeHtml(value);
						html = html.replace(/\[password\]/ig, '<div class="password_border">');
						html = html.replace(/\[\/password\]/ig, '</div>');
						var weixin_scan = '';
						if ('1' === scope.canWeixinScan) {
							weixin_scan = ' 或者 <a href="javascript:void(0);"  ng-click="weixin_request()">微信扫码求简历</a>    ';
						}
						$(element).html('<div class="resume_content">' + html + '</div>');
						$(element).find('p:contains("[hidden]")').html('<div class="password"> <h3>此段内容已被阅读密码保护</h3> 您可以  <a href="javascript:void(0);" ng-click="input_password()">输入密码</a>' + weixin_scan + '</div>');
						$(element).find('p:contains("[error]")').html('<div class="password error"> <h3>密码错误</h3> 您可以  <a href="javascript:void(0);" ng-click="input_password()">输入密码</a> ' + weixin_scan + '   </div>');
						var $resume_content = $(element).find('.resume_content');
						var newscope = $rootScope.$new();
						var link = $compile($resume_content);
						var ctrl = $controller("ghostdownCtrl", { $scope: newscope });
						$($resume_content).data('$ngControllerController', ctrl);
						link(newscope);
					}
				}
			});
		}
	};
})

;
