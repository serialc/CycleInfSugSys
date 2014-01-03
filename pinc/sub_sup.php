<?php
// filename: sub_sup.php
// user supports and existing comment

date_default_timezone_set('CET');

$DEBUG = false;

# get the varaibles and sanitize them
$name = preg_replace("/[^a-zA-Z\s]/", '', $_GET['name'] );
$comment = preg_replace("/[^a-zA-Z0-9\.!?\-\s\+]/", '', $_GET['comment'] );
$id = preg_replace("/[^0-9\.\_]/", '', $_GET['id'] );

if ( $DEBUG ) {
	print($name);
	print('<br>');
	print($comment);
	print('<br>');
	print($id);
	print('<br>');
}

$errors = '';
// check inputs
// check that there is a name (comment is optional)
if ( $name == '' ) {
	$errors .= "Please provide your name.<br>\n";
}

if ( $comment == '' ) {
	$errors .= "Please provide a comment.<br>\n";
}

// check if there were any errors and if so, return message and quit/return
if ( $errors != '' ) {
	print($errors);
	return;
}

// create new suggestion location
// create an object to manage the file/data system

include('data_handler.php');

if ( $dh->add_support(array("name" => $name,
							"com" => $comment,
							"id" => $id)) ) {
	print("Success!");
} else {
	print("Failure!");
}

?>
