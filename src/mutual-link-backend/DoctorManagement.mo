import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";
import Array "mo:base/Array";

module {
    public type Doctor = {
        id: Nat;
        name: Text;
        email: Text;
        phone: Text;
        hospital: Text;
        department: Text;
        role: Text;
        publicKey: ?Text;
    };

    public class DoctorManager() {
        private var doctors = HashMap.HashMap<Nat, Doctor>(1, Nat.equal, Hash.hash);
        private var nextId : Nat = 1;

        public func updateDoctor(doctor: Doctor) : Result.Result<Doctor, Text> {
            let id = if (doctor.id == 0) {
                let id = nextId;
                nextId += 1;
                id;
            } else {
                doctor.id
            };

            let newDoctor = {
                id = id;
                name = doctor.name;
                email = doctor.email;
                phone = doctor.phone;
                hospital = doctor.hospital;
                department = doctor.department;
                role = doctor.role;
                publicKey = doctor.publicKey;
            };

            doctors.put(id, newDoctor);
            #ok(newDoctor)
        };

        public func deleteDoctor(id: Nat) : Result.Result<(), Text> {
            switch (doctors.remove(id)) {
                case (null) { #err("해당 ID의 의사를 찾을 수 없습니다.") };
                case (?_) { #ok(()) };
            }
        };

        public func getAllDoctors() : [Doctor] {
            Iter.toArray(doctors.vals())
        };

        public func getDoctor(id: Nat) : ?Doctor {
            doctors.get(id)
        };

        public func updateDoctorPublicKey(email: Text, publicKey: Text) : Result.Result<Doctor, Text> {
            let doctorsArray = Iter.toArray(doctors.vals());
            let doctorOpt = Array.find<Doctor>(doctorsArray, func(doc: Doctor) : Bool {
                doc.email == email
            });
            
            switch (doctorOpt) {
                case (null) { #err("해당 이메일의 의사를 찾을 수 없습니다.") };
                case (?doctor) {
                    let updatedDoctor = {
                        id = doctor.id;
                        name = doctor.name;
                        email = doctor.email;
                        phone = doctor.phone;
                        hospital = doctor.hospital;
                        department = doctor.department;
                        role = doctor.role;
                        publicKey = ?publicKey;
                    };
                    doctors.put(doctor.id, updatedDoctor);
                    #ok(updatedDoctor)
                };
            }
        };
    };
};