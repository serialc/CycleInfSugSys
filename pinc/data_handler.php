<?php

class datah {
	
	# define private/public attributes here
	private $passwd = '';
	private $coms = 'uninitialized';
	private $data_path = '../data/coms.json';

	# loads the data into an attribute
	public function __construct() {	
		# open data
		$data_json = file_get_contents($this->data_path);

		# convert from json string to php array
		$this->coms = json_decode($data_json, true);
	}

	# get all the suggestions
	public function get_data() {
		return $this->coms;
	}

	# chack if a comment at these coords already exists, return true/false
	private function comment_id_exists( $id ) {
		# iterate through comments
		foreach ( $this->coms['cycling_comments'] as $com ) {
			if ( $com['id'] == $id ) {
				// found it
				return true;
			}
		}
		// didn't find it
		return false;
	}

	# update the data based on the object attribute $this->coms
	private function update_data_list() {
		# open, write to file, close
		$fh = fopen($this->data_path, 'w');
		# check if there were problems writing to the file
		if ( !fwrite($fh, json_encode($this->coms)) ) {
			print('<strong>Unable to write to disk!</strong>');
		}

		fclose($fh);

		return true;
	}

	# add a feature
	public function add_feature($comment) {

		# check if there is an existing comment with the same id(lat/lng centroid)
		if ( $this->comment_id_exists($comment['id']) ) {
			return false;
		}

		# ok, submit
		# prepare the new data
		$comment['support_comments'] = array();

		# update array and local variable, add the new suggestion to the list
		array_push($this->coms['cycling_comments'], $comment);

		// update the data file
		if ( $this->update_data_list() ) return true;

		return false;
	}

	# rem a feature
	public function rem_feature($fid, $sid, $sub_passwd) {
		# NOT IMPLEMENTED AND NOT FINISHED

		# check that passwd is defined and that matches
		if($this->passwd != '' && $this->passwd == $sub_passwd) {
			# get fid, remove sid and submit for file update

		} else {
			# password failure
			return('PWF');
		}
	}
	

	# add a supportive comment to a feature
	public function add_support( $support_array ) {

		# find the feature with this id
		foreach ( $this->coms['cycling_comments'] as &$com ) {
			if ( strcmp($com['id'],  $support_array['id']) == 0 ) {
				array_push($com['support_comments'], array_slice($support_array, 0, 2));
				
				// update the data file
				if ( $this->update_data_list() ) return true;
			}
		}
		return false;
	}
}

$dh = new datah();

?>
